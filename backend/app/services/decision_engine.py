"""Deterministic, explainable decision engine.

Every recommendation carries: what to do (`action`), why (`why`), the expected effect
(`expected_impact`), the kind of effect (`effect_type`) and how strong the supporting basis is
(`basis`). This engine is also the fallback when Gemini is unavailable, so the app is always useful.

Sensitivity rule (documented assumption): households with children, older adults or someone with a
heart/lung condition are treated one level more cautiously when AQI is in the "Moderate" band. This is
a conservative rule of thumb, not a clinical threshold.
"""
from datetime import datetime

from . import aqi as aqi_mod

DISCLAIMER = ("General guidance based on air-quality data and public-health rules of thumb. "
              "It is not medical advice. Follow your clinician's advice if you have a heart or lung condition.")
EXPOSED_MODES = ("walk", "bicycle", "two_wheeler")
LEVEL_NAMES = ("good", "moderate", "caution", "avoid", "stay_in", "stay_in")
BLOCKS = (("Morning commute and school run", 7, 10), ("Midday", 10, 16), ("Evening commute and play", 16, 20))


# ------------------------------------------------------------------ helpers
PRIORITY_NAMES = {1: "High", 2: "Medium", 3: "Low"}
CATEGORY_MAP = {
    "commute": "Travel",
    "school": "Travel",
    "work": "Indoor",
    "exercise": "Outdoor",
    "ventilation": "Indoor",
    "cooking": "Indoor",
    "dust": "Indoor",
    "filtration": "Indoor",
    "alternatives": "Sustainability",
    "community": "Sustainability",
}


def rec(id_, area, title, action, why, impact, effect_type, basis, priority=2, timing=None, difficulty=None, assumptions=None) -> dict:
    """Build a structured recommendation with both master prompt and backward-compatible fields."""
    cat = CATEGORY_MAP.get(area, "Indoor")
    prio_label = PRIORITY_NAMES.get(priority, "Medium")
    time_val = timing or ("Morning peak (07:00-10:00)" if area in ("commute", "school") else (
        "During cleanest daytime slot" if area in ("exercise", "ventilation") else (
            "During and after food prep" if area == "cooking" else (
                "Continuous indoors" if area == "filtration" else "Whenever applicable"
            )
        )
    ))
    diff_val = difficulty or ("Medium" if "purifier" in id_ or "carpool" in id_ else ("Low" if "transit" in id_ or "seal" in id_ else "Free"))
    assump = assumptions or ["Based on US EPA AQI breakpoints, WHO 2021 air quality guidelines, and empirical indoor/outdoor infiltration factors."]
    return {
        # Master Prompt schema fields
        "title": title,
        "action": action,
        "reason": why,
        "timing": time_val,
        "benefit": impact,
        "category": cat,
        "priority": priority,  # keep int for numeric comparisons and test assertions
        "priority_label": prio_label,
        "difficulty": diff_val,
        "estimated_impact": impact,
        "assumptions": assump,
        # Legacy/app fields
        "id": id_,
        "area": area,
        "why": why,
        "expected_impact": impact,
        "effect_type": effect_type,
        "basis": basis,
        "priority_level": priority,
    }


def is_sensitive(household: dict) -> bool:
    return bool(household["children"] or household["older_adults"] or household["respiratory_condition"])


def risk_level(aqi: float | None, sensitive: bool) -> dict:
    """Map AQI + household sensitivity to an effective level index (0-5)."""
    cat = aqi_mod.categorize(aqi)
    if cat["index"] is None:
        return {"index": None, "name": "unknown", "aqi": None, "category": cat, "adjusted": False}
    idx = cat["index"]
    adjusted = sensitive and idx == 1
    eff = idx + 1 if adjusted else idx
    return {"index": eff, "name": LEVEL_NAMES[eff], "aqi": aqi, "category": cat, "adjusted": adjusted}


def _mean(values):
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def future_hours(air: dict, hours: int = 24) -> list[dict]:
    """Forecast entries from the current hour onward (next `hours` hours)."""
    return air["hourly"][air["now_index"]: air["now_index"] + hours]


def _label_day(time_str: str, now_str: str) -> str:
    return "today" if time_str[:10] == now_str[:10] else "tomorrow"


def _hour(entry) -> int:
    return int(entry["time"][11:13])


def best_window(hours: list[dict], start_h: int = 6, end_h: int = 21, width: int = 2, worst: bool = False):
    """Return the contiguous `width`-hour window within [start_h, end_h) with the lowest (or highest) mean AQI."""
    cand = [h for h in hours if start_h <= _hour(h) < end_h and h["us_aqi"] is not None]
    best = None
    for i in range(len(cand) - width + 1):
        chunk = cand[i:i + width]
        # require consecutive hours
        if any((datetime.fromisoformat(chunk[j + 1]["time"]) - datetime.fromisoformat(chunk[j]["time"])).total_seconds() != 3600
               for j in range(width - 1)):
            continue
        mean_aqi = _mean(c["us_aqi"] for c in chunk)
        mean_pm = _mean(c["pm2_5"] for c in chunk)
        better = best is None or (mean_aqi > best["mean_aqi"] if worst else mean_aqi < best["mean_aqi"])
        if better:
            end_dt = datetime.fromisoformat(chunk[-1]["time"]).replace(minute=0)
            best = {"start": chunk[0]["time"], "end": f"{end_dt.hour + 1:02d}:00" if end_dt.hour < 23 else "24:00",
                    "mean_aqi": mean_aqi, "mean_pm2_5": mean_pm, "category": aqi_mod.categorize(mean_aqi)}
    return best


def compute_trend(air: dict) -> dict:
    """Compare the mean AQI of the next 6 h with the previous 6 h."""
    i, hourly = air["now_index"], air["hourly"]
    prev, nxt = _mean(h["us_aqi"] for h in hourly[max(0, i - 6):i]), _mean(h["us_aqi"] for h in hourly[i:i + 6])
    if prev is None or nxt is None:
        return {"direction": "unknown", "change": None, "text": "Not enough data to show a trend."}
    change = round(nxt - prev)
    if change >= 15:
        direction, text = "rising", f"AQI is expected to rise by about {change} points over the next 6 hours compared with the last 6 hours."
    elif change <= -15:
        direction, text = "improving", f"AQI is expected to fall by about {abs(change)} points over the next 6 hours compared with the last 6 hours."
    else:
        direction, text = "steady", "AQI is expected to stay roughly steady over the next 6 hours."
    return {"direction": direction, "change": change, "text": text}


# ------------------------------------------------------------------ planner
def _block_status(eff: int | None) -> tuple[str, str]:
    if eff is None:
        return "unknown", "No data"
    return (("good", "Good time"), ("good", "Fine"), ("caution", "Take care"),
            ("avoid", "Limit time outside"), ("avoid", "Stay indoors if you can"), ("avoid", "Stay indoors"))[eff]


def build_blocks(air: dict, sensitive: bool) -> list[dict]:
    hours, now_str = future_hours(air, 24), air["current"]["time"]
    out = []
    for name, s, e in BLOCKS:
        chunk = [h for h in hours if s <= _hour(h) < e]
        if not chunk:
            continue
        mean_aqi = _mean(h["us_aqi"] for h in chunk)
        lvl = risk_level(mean_aqi, sensitive)
        tone, label = _block_status(lvl["index"])
        low = min((h for h in chunk if h["us_aqi"] is not None), key=lambda h: h["us_aqi"], default=None)
        out.append({"name": name, "day": _label_day(chunk[0]["time"], now_str), "from": f"{s:02d}:00", "to": f"{e:02d}:00",
                    "mean_aqi": mean_aqi, "category": lvl["category"], "tone": tone, "status": label,
                    "cleanest_hour": None if low is None else f"{_hour(low):02d}:00",
                    "cleanest_hour_aqi": None if low is None else low["us_aqi"]})
    return out


def planner_recs(profile: dict, air: dict, lvl: dict, blocks: list[dict], window: dict | None) -> list[dict]:
    eff, aqi = lvl["index"], lvl["aqi"]
    hh, commute, life = profile["household"], profile["commute"], profile["lifestyle"]
    recs = []
    morning = next((b for b in blocks if b["name"].startswith("Morning")), None)
    m_note = ""
    if morning and morning["cleanest_hour"]:
        m_note = f" The forecast cleanest hour in the morning block ({morning['day']}) is {morning['cleanest_hour']} (AQI about {morning['cleanest_hour_aqi']})."

    # --- commute
    mode = commute["mode"]
    if eff is None:
        pass
    elif mode in EXPOSED_MODES and eff >= 2:
        recs.append(rec("commute-exposed", "commute", "Reduce exposure on your commute",
                        "If you can, switch to a metro, bus or car for now, or travel in the cleanest hour you can. If you must "
                        "walk, cycle or ride, avoid main roads and wear a well-fitted N95/FFP2-type respirator." + m_note,
                        f"AQI is {aqi} ({lvl['category']['label']}). Walking, cycling and open two-wheelers raise breathing rate and put you close to traffic exhaust.",
                        "May lower the particles you breathe during the trip. It does not change city emissions unless you move to public transport.",
                        "personal_exposure", "guideline", 1))
    elif mode == "car" and eff >= 2:
        recs.append(rec("commute-car", "commute", "Keep cabin air cleaner",
                        "Keep windows closed, use recirculation on busy roads, avoid idling, and replace the cabin filter on schedule." + m_note,
                        f"AQI is {aqi}; in-vehicle air follows road air, and cabin filters only work when maintained.",
                        "May reduce particles inside the car. Avoiding idling also cuts the exhaust you add to the street.",
                        "both", "general_practice", 2))
    elif mode in ("bus", "metro") and eff >= 2:
        recs.append(rec("commute-transit", "commute", "Keep taking public transport, wait indoors",
                        "Wait in covered or indoor areas rather than at the roadside, and consider a respirator at crowded, dusty stops." + m_note,
                        f"AQI is {aqi}. Public transport is already a lower-emission way to travel, and waiting away from traffic lowers exposure.",
                        "Shared transport lowers emissions per passenger; waiting indoors modestly lowers your own exposure.",
                        "both", "general_practice", 3))
    elif eff is not None:
        recs.append(rec("commute-ok", "commute", "Your usual commute is fine today",
                        "Travel as normal." + m_note,
                        f"AQI is {aqi} ({lvl['category']['label']}), a range where routine travel is not expected to need extra precautions.",
                        "No extra exposure reduction is needed; choosing public transport still lowers emissions.", "awareness", "guideline", 3))

    # --- exercise
    if eff is not None:
        win_txt = ""
        if window:
            win_txt = (f" The cleanest 2-hour daytime slot in the next 24 hours starts at {window['start'][11:16]} "
                       f"(about AQI {window['mean_aqi']}, {window['category']['label']}).")
        if eff >= 3:
            recs.append(rec("exercise-indoor", "exercise", "Move exercise indoors",
                            "Do workouts indoors (yoga, stairs, bodyweight circuits) and keep outdoor time short and light." + win_txt,
                            f"Hard exercise multiplies how much air you breathe, and AQI is {aqi} ({lvl['category']['label']}).",
                            "Avoiding outdoor exertion on high-AQI days may lower the particle dose reaching your lungs.", "personal_exposure", "guideline", 1))
        elif eff == 2:
            recs.append(rec("exercise-limit", "exercise", "Shorten and soften outdoor exercise",
                            "Keep outdoor sessions short and moderate, and choose the cleanest slot." + win_txt,
                            f"AQI is {aqi}; people in sensitive groups are advised to reduce prolonged or heavy exertion at this level.",
                            "Choosing a cleaner slot can meaningfully lower the AQI you exercise in; the forecast gap is shown above.", "personal_exposure", "forecast", 2))
        else:
            recs.append(rec("exercise-ok", "exercise", "Outdoor exercise is fine",
                            "Go ahead; the cleanest slot is still the best choice if your schedule is flexible." + win_txt,
                            f"AQI is {aqi} ({lvl['category']['label']}).", "No extra precautions expected to be needed.", "awareness", "guideline", 3))

    # --- school
    if hh["children"] and eff is not None:
        if eff >= 3:
            recs.append(rec("school-indoor", "school", "Ask school to keep children indoors",
                            "Ask the school to move PE, assembly and recess indoors today. Prefer indoor play at home. Choose short, covered school-run routes.",
                            f"Children breathe faster relative to body size and AQI is {aqi}. Many school air-quality programmes advise indoor activity at this level.",
                            "Reducing outdoor exertion lowers children's particle dose. Respirators fit children poorly, so limiting time outside is the main lever.",
                            "personal_exposure", "guideline", 1))
        elif eff == 2:
            recs.append(rec("school-limit", "school", "Limit strenuous outdoor play",
                            "Allow normal school, but ask that heavy sports and long outdoor sessions are shortened or moved indoors.",
                            f"AQI is {aqi}; children are a sensitive group.", "Modest reduction in dose for the most active hours.", "personal_exposure", "guideline", 2))
        else:
            recs.append(rec("school-ok", "school", "Normal school day",
                            "No extra measures needed; keep checking this planner if AQI changes.", f"AQI is {aqi} ({lvl['category']['label']}).",
                            "Routine outdoor activity is expected to be fine.", "awareness", "guideline", 3))

    # --- work
    if eff is not None and eff >= 2:
        if life["works_from_home"]:
            recs.append(rec("work-home", "work", "Stay in during peak hours",
                            "Plan errands and outdoor breaks for the cleanest slot; keep windows closed at your desk during peaks.",
                            f"You work from home and AQI is {aqi}, so scheduling is the easiest way to cut exposure.",
                            "Shifting short outdoor trips to the cleaner slot can lower exposure at no cost.", "personal_exposure", "forecast", 2))
        else:
            recs.append(rec("work-shift", "work", "Shift outdoor tasks and lunch breaks",
                            "If your employer allows, move outdoor tasks to the cleanest slot or work remotely on the worst day.",
                            f"AQI is {aqi}; fewer hours outdoors at peak means lower dose.",
                            "Fewer hours in polluted air lowers personal exposure. A remote day also removes one commute's emissions.", "both", "general_practice", 3))
    return recs


# ------------------------------------------------------------------ indoor
def indoor_recs(profile: dict, air: dict, lvl: dict, vent_window: dict | None) -> list[dict]:
    eff, aqi = lvl["index"], lvl["aqi"]
    ind, hh = profile["indoor"], profile["household"]
    recs = []
    win = f" The cleanest 2-hour slot in the forecast starts at {vent_window['start'][11:16]} (AQI about {vent_window['mean_aqi']})." if vent_window else ""
    if eff is not None:
        if eff <= 1:
            recs.append(rec("vent-open", "ventilation", "Ventilate normally",
                            "Open windows for fresh air, especially after cooking or cleaning.", f"Outdoor AQI is {aqi} ({lvl['category']['label']}), usually cleaner than stale indoor air.",
                            "Lowers indoor pollutants such as cooking particles and CO2.", "personal_exposure", "general_practice", 3))
        elif eff == 2:
            recs.append(rec("vent-short", "ventilation", "Ventilate briefly in the cleanest slot",
                            "Keep windows closed most of the day. Air the home for 10-15 minutes in the cleanest slot." + win,
                            f"Outdoor AQI is {aqi}. Short airing refreshes the home while limiting how much outdoor smog comes in.",
                            "Lowers the total outdoor particles entering compared with leaving windows open all day.", "personal_exposure", "forecast", 2))
        else:
            recs.append(rec("vent-closed", "ventilation", "Keep windows and doors closed",
                            "Keep windows closed, especially those facing the road. If you must air the home, do it briefly in the cleanest slot." + win,
                            f"Outdoor AQI is {aqi} ({lvl['category']['label']}), so outdoor air is likely worse than indoor air.",
                            "Reduces the infiltration of outdoor particles. Indoor levels are typically lower than outdoor ones when the home is closed, though not zero.",
                            "personal_exposure", "general_practice", 1))
    if ind["windows"] == "leaky" and (eff or 0) >= 2:
        recs.append(rec("seal-gaps", "ventilation", "Seal obvious gaps",
                        "Fit door sweeps and weather-strip gaps around windows in the main living and sleeping rooms.",
                        "Your home has leaky windows, so outdoor smog enters even with windows shut.",
                        "May reduce outdoor particles infiltrating the home; the size depends on how leaky the home is.", "personal_exposure", "general_practice", 2))
    if ind["near_busy_road"] and (eff or 0) >= 2:
        recs.append(rec("road-side", "ventilation", "Use rooms away from the road",
                        "Keep windows on the road side shut, and use bedrooms or rooms facing away from traffic when you can.",
                        "Air near busy roads usually carries more traffic exhaust particles.", "May lower exposure at home.", "personal_exposure", "general_practice", 2))

    # cooking
    fuel = ind["cooking_fuel"]
    if fuel == "biomass":
        recs.append(rec("cook-biomass", "cooking", "Cut cooking smoke first",
                        "Cook in a space that vents outdoors, keep the kitchen door shut, and keep children and older adults out of the kitchen while cooking. "
                        "Move to LPG or electric/induction where you can.",
                        "Burning wood or other biomass indoors produces large amounts of fine particles, a major source of household air pollution.",
                        "Cleaner cooking can cut indoor particles substantially and also reduces smoke released to the neighbourhood.", "both", "guideline", 1))
    else:
        hood = "Run the range hood (vented outside) on every cook" if ind["has_range_hood"] else "Use an exhaust fan or open a kitchen window while cooking if outdoor AQI is 100 or below"
        recs.append(rec("cook-gas", "cooking", "Control cooking smoke",
                        f"{hood}. Use lower heat for frying and keep the kitchen door shut so smoke stays out of living areas.",
                        "Frying and high-heat cooking release particles indoors, and these add to what comes in from outside.",
                        "Venting at the source lowers indoor particle peaks during and after cooking.", "personal_exposure", "general_practice", 2))
        if (eff or 0) >= 3 and not ind["has_range_hood"]:
            recs.append(rec("cook-closed", "cooking", "Cook with care on high-AQI days",
                            "Prefer steaming, boiling and slow cooking over frying today, and open the window only briefly after cooking.",
                            f"Outdoor AQI is {aqi}, so opening windows wide to clear smoke would bring in polluted air.",
                            "Reduces smoke created indoors without drawing in more outdoor smog.", "personal_exposure", "general_practice", 2))

    # dust
    recs.append(rec("dust", "dust", "Clean dust without raising it",
                    "Damp-mop floors and damp-wipe surfaces instead of dry sweeping. Vacuum with a HEPA-filter vacuum if you have one. "
                    "Avoid incense, mosquito coils and candles on poor-air days.",
                    "Dry sweeping lifts settled dust back into the air, and smoke from coils and incense adds fine particles indoors.",
                    "Lowers resuspended dust and removes an easy-to-avoid indoor source of particles.", "personal_exposure", "general_practice", 3))

    # filtration & maintenance
    if ind["has_purifier"]:
        recs.append(rec("filter-use", "filtration", "Run your purifier smartly",
                        "Keep it running in the room where you spend most time, on a higher setting during the worst hours, with doors closed. Check and replace filters as the maker advises.",
                        "A purifier only helps when the filter is fresh and the room is not constantly being refilled with outdoor air.",
                        "In a closed room, a correctly sized HEPA purifier can lower indoor particle levels; results depend on room size and filter condition.",
                        "personal_exposure", "general_practice", 2 if (eff or 0) >= 2 else 3, timing="Continuous in closed room", difficulty="Free"))
        recs.append(rec("filter-maint", "filtration", "Maintain filters on schedule",
                        "Vacuum or rinse the mesh pre-filter every 3-4 weeks to remove coarse hair and dust. Inspect the HEPA cartridge and replace every 6-12 months. Never wash true HEPA paper filters.",
                        "Clogged pre-filters restrict airflow and drop the Clean Air Delivery Rate (CADR).",
                        "Maintains manufacturer-rated particle capture efficiency and extends motor lifespan.",
                        "personal_exposure", "general_practice", 3, timing="Monthly check", difficulty="Low"))
    elif (eff or 0) >= 2 and (is_sensitive(hh) or (eff or 0) >= 3):
        recs.append(rec("filter-get", "filtration", "Consider a purifier for the bedroom",
                        "A portable HEPA purifier sized to the room (check its clean-air delivery rate, CADR) is worth considering for the room where the household sleeps. Avoid devices that make ozone on purpose.",
                        f"AQI is {aqi} and your home has no purifier. Sleeping hours are the longest continuous time at home.",
                        "Can lower indoor particles in that room when doors and windows stay closed. It does nothing for outdoor air or emissions.",
                        "personal_exposure", "general_practice", 2, timing="Before winter peak", difficulty="Medium"))

    # Evidence-based indoor advice
    recs.append(rec("houseplant-reality", "filtration", "Rely on filtration, not houseplants, for PM2.5",
                    "Keep houseplants for greenery and well-being, but do not rely on them to clean particulate smog. Use certified mechanical HEPA filtration for fine particles.",
                    "Controlled research demonstrates that potted houseplants remove virtually no ambient PM2.5 or gaseous pollutants at typical residential air-exchange rates.",
                    "Clarifies effective protection and prevents a false sense of indoor safety.",
                    "awareness", "guideline", 3, timing="Ongoing awareness", difficulty="Free"))
    return recs


# ------------------------------------------------------------------ alternatives and community
def alternative_recs(profile: dict, lvl: dict) -> list[dict]:
    mode, minutes = profile["commute"]["mode"], profile["commute"]["minutes_one_way"]
    recs = []
    if mode in ("car", "two_wheeler"):
        recs.append(rec("alt-transit", "alternatives", "Try metro or bus for some trips",
                        "Replace even 1-2 commute days a week with metro or bus where a route exists.",
                        "Shared transport emits less per passenger-km than a private car or two-wheeler.",
                        "Lowers your transport emissions. Use the impact calculator to estimate kg CO2e; local PM2.5 effects are not quantified.",
                        "emission_reduction", "general_practice", 1))
        recs.append(rec("alt-carpool", "alternatives", "Share rides with colleagues or school families",
                        "Form a carpool of 2-4 people for the same route, or share the school run.",
                        "More people per vehicle means fewer vehicles and less idling at school gates and junctions.",
                        "Emissions per person fall roughly in proportion to occupancy; the calculator shows an estimate.", "emission_reduction", "general_practice", 2))
    if mode in ("car", "two_wheeler", "bus", "metro", "other") and minutes <= 25:
        recs.append(rec("alt-active", "alternatives", "Walk or cycle short trips on cleaner days",
                        "On days when AQI is 100 or below, walk or cycle trips under about 3 km and quieter routes.",
                        "Short trips by car have high emissions per km and add to local congestion.",
                        "Removes the trip's tailpipe emissions. On high-AQI days, prefer enclosed transport to avoid heavy exertion outdoors.", "emission_reduction", "general_practice", 3))
    recs.append(rec("alt-habits", "alternatives", "Cut idling and combine errands",
                    "Switch the engine off if you wait for more than about a minute, combine errands into one trip, and keep tyres inflated and the vehicle serviced.",
                    "Idling and stop-start driving burn fuel without moving you anywhere.",
                    "Lowers fuel use and exhaust per trip. Savings are small per person but add up across a neighbourhood.", "emission_reduction", "general_practice", 3))
    return recs


def community_recs(lvl: dict) -> list[dict]:
    eff = lvl["index"] or 0
    recs = [
        rec("com-report", "community", "Report visible sources",
            "Use the Community tab to log open burning, construction dust or smoky vehicles in your area, and share the details with your local authority.",
            "Open burning and dust are controllable local sources, and clear reports help the right office act.",
            "Reports alone do not clean the air. They help neighbours see patterns and give authorities specific places to check.", "awareness", "general_practice", 2),
        rec("com-burn", "community", "Do not burn waste or leaves",
            "Take waste to proper collection, and ask your housing society to arrange winter heating without burning rubbish.",
            "Burning waste releases fine particles and toxic gases at ground level, right where people breathe.",
            "Avoiding a burn directly removes that source's emissions from your street.", "emission_reduction", "guideline", 1),
    ]
    if eff >= 2:
        recs.append(rec("com-check", "community", "Check on neighbours at higher risk",
                        "Share today's plan with older neighbours and families with young children, and with your school or housing-society group.",
                        f"On days at this level, sensitive groups benefit most from timely information.",
                        "Spreads the exposure-reduction steps to people who may not check forecasts.", "awareness", "general_practice", 2))
    return recs


# ------------------------------------------------------------------ alerts
def build_alerts(profile: dict, air: dict, lvl: dict, trend: dict) -> list[dict]:
    sensitive = is_sensitive(profile["household"])
    cur = air["current"]
    cur_pm25 = cur.get("pm2_5")
    hours = [h for h in future_hours(air, 24) if h["us_aqi"] is not None]
    alerts = []
    if not hours:
        return alerts

    # Peak AQI alerts
    peak = max(hours, key=lambda h: h["us_aqi"])
    peak_lvl = risk_level(peak["us_aqi"], sensitive)
    when = f"{_label_day(peak['time'], air['current']['time'])} around {peak['time'][11:16]}"
    if peak_lvl["index"] >= 4:
        alerts.append({"id": "peak-severe", "severity": "danger", "title": "Severe Smog Alert",
                       "message": f"AQI is forecast to reach {peak['us_aqi']} ({peak_lvl['category']['label']}) {when}.",
                       "why": "The forecast for the next 24 hours crosses into the 'Very unhealthy' or 'Hazardous' range.",
                       "action": "Avoid non-essential outdoor trips, keep windows sealed, and run HEPA filtration continuously."})
    elif peak_lvl["index"] >= 3:
        alerts.append({"id": "peak-high", "severity": "warning", "title": "Unhealthy Air Expected",
                       "message": f"AQI may reach about {peak['us_aqi']} ({peak_lvl['category']['label']}) {when}.",
                       "why": "The forecast for the next 24 hours reaches the 'Unhealthy' range.",
                       "action": "Move outdoor exercise and school sports away from peak hours."})
    elif peak_lvl["index"] == 2:
        alerts.append({"id": "peak-usg", "severity": "info", "title": "Sensitive Groups: Take Care",
                       "message": f"AQI may reach about {peak['us_aqi']} {when}." + (" Your household includes sensitive members." if sensitive else ""),
                       "why": "Forecast reaches 'Unhealthy for sensitive groups' or higher for your household.",
                       "action": "Shorten outdoor exertion around that time."})

    # High PM2.5 spike alert
    if cur_pm25 is not None and cur_pm25 >= 60 and not any(a["id"] == "peak-severe" for a in alerts):
        alerts.append({"id": "pm25-spike", "severity": "warning", "title": "Elevated Fine Particles (PM2.5)",
                       "message": f"Current PM2.5 is {cur_pm25} µg/m³ (approx {round(cur_pm25 / aqi_mod.WHO_PM25_24H, 1)}× the WHO 24-hr guideline).",
                       "why": "Fine particles penetrate deep into alveolar lung tissue and the bloodstream.",
                       "action": "Wear an N95 respirator if commuting on foot, cycle, or two-wheeler."})

    # Deteriorating trend alert
    if trend["direction"] == "rising" and not any(a["severity"] == "danger" for a in alerts):
        alerts.append({"id": "trend-rising", "severity": "info", "title": "Air Quality Deteriorating",
                       "message": trend["text"], "why": "Recent hours were cleaner than the upcoming forecast.",
                       "action": "Complete essential outdoor errands early before smog builds up."})

    # Exercise alert
    if profile["lifestyle"]["outdoor_exercise"] == "regular" and (lvl["index"] or 0) >= 3:
        alerts.append({"id": "exercise-caution", "severity": "warning", "title": "Outdoor Exercise Inadvisable",
                       "message": "High particulate levels make strenuous outdoor cardio counter-productive today.",
                       "why": "Heavy aerobic breathing bypasses nasal filters and multiplies total particulate deposition.",
                       "action": "Switch to indoor bodyweight training, yoga, or an indoor gym."})

    # All-clear condition
    if lvl["index"] is not None and lvl["index"] <= 1 and not alerts:
        alerts.append({"id": "all-clear", "severity": "ok", "title": "All Clear: Favourable Air",
                       "message": "Forecast stays in a comfortable range for the next 24 hours.",
                       "why": "No forecast hour reaches 'Unhealthy for sensitive groups'.",
                       "action": "Enjoy outdoor activities and ventilate your home freely."})
    return alerts


def build_daily_schedule(profile: dict, air: dict, lvl: dict, blocks: list[dict], window: dict | None, vent_window: dict | None) -> list[dict]:
    """Generates the comprehensive 8-phase smart daily routine schedule per Challenge Module 4."""
    eff = lvl["index"] if lvl["index"] is not None else 1
    aqi_val = lvl["aqi"] or 50
    cat_label = lvl["category"]["label"]
    commute = profile["commute"]
    ind = profile["indoor"]
    clean_win = f"{window['start'][11:16]}–{window['end']}" if window else "Midday (12:00–14:00)"
    vent_win = f"{vent_window['start'][11:16]}–{vent_window['end']}" if vent_window else "Afternoon"

    items = []

    # 1. Morning Routine
    m_act = "Keep windows sealed against nocturnal/morning smog inversion. Check today's AQI before opening doors." if eff >= 2 else "Open windows for a gentle morning air exchange. Check the forecast before heading out."
    items.append({
        "phase": "Morning Routine",
        "time": "06:00 – 08:30",
        "status": "Cautious" if eff >= 2 else "Optimal",
        "action": m_act,
        "why": "Morning temperature inversions frequently trap vehicular emissions and ground smoke near the surface.",
        "indoor_alternative": "Do morning stretches or light mobility indoors away from road-facing windows."
    })

    # 2. Travel & Commute Precautions
    if commute["mode"] in EXPOSED_MODES:
        c_act = f"Wear a well-fitted N95/FFP2 respirator. Avoid busy multi-lane corridors. If possible, travel closer to {clean_win}." if eff >= 2 else "Travel as usual. Walking or cycling offers active fitness and zero emissions."
    else:
        c_act = "Set car ventilation to internal recirculation on arterial roads; keep bus/train windows closed during peak traffic." if eff >= 2 else "Commute as usual. Public transit lowers your carbon footprint."
    items.append({
        "phase": "Travel & Commute",
        "time": "08:30 – 10:30",
        "status": "High Exposure" if eff >= 3 else ("Moderate" if eff == 2 else "Normal"),
        "action": c_act,
        "why": f"Current AQI is {aqi_val} ({cat_label}). Traffic corridors have concentrated ultrafine particulates and toxic NO2.",
        "indoor_alternative": "Coordinate flexible check-in or partial work-from-home during winter smog spikes."
    })

    # 3. Outdoor Exercise Suggestions
    if eff >= 3:
        ex_act = "Avoid outdoor running or intense sports today. Shift workouts entirely indoors."
        ex_alt = "Indoor bodyweight circuit, yoga, or indoor gym workout."
    elif eff == 2:
        ex_act = f"Limit outdoor exercise to moderate intensity strictly within the cleanest slot ({clean_win})."
        ex_alt = "Indoor gym workout or brisk indoor walking."
    else:
        ex_act = f"Outdoor exercise is safe and encouraged today. Ideal outdoor window: {clean_win}."
        ex_alt = "Outdoor jogging, park sports, or cycling."
    items.append({
        "phase": "Exercise & Fitness",
        "time": clean_win,
        "status": "Move Indoors" if eff >= 3 else ("Restricted" if eff == 2 else "Safe"),
        "action": ex_act,
        "why": "High-intensity aerobic respiration increases particle inhalation volume up to tenfold into deep lung tissue.",
        "indoor_alternative": ex_alt
    })

    # 4. School and Work Precautions
    sw_act = "Keep classroom and office windows closed during peak traffic hours. Sensitive children should avoid heavy playground exertion." if eff >= 2 else "Normal school and workplace routine. Keep indoor spaces well-ventilated."
    items.append({
        "phase": "School & Workplace",
        "time": "10:30 – 16:00",
        "status": "Protection Needed" if eff >= 2 else "Normal",
        "action": sw_act,
        "why": "Children breathe more air per kilogram of body weight than adults, making them especially vulnerable to elevated PM2.5.",
        "indoor_alternative": "Move school recess or physical education to indoor gymnasiums or sheltered halls."
    })

    # 5. Indoor Activity Alternatives
    ind_act = "Encourage reading, board games, indoor hobbies, and indoor play instead of outdoor parks during smog spikes." if eff >= 2 else "Enjoy both indoor and outdoor recreational activities as desired."
    items.append({
        "phase": "Indoor Activity Alternatives",
        "time": "14:00 – 17:00",
        "status": "Recommended" if eff >= 2 else "Optional",
        "action": ind_act,
        "why": "Limiting cumulative daytime outdoor hours directly reduces cumulative particle exposure (µg/m³ × hours).",
        "indoor_alternative": "Community centers, indoor play areas, libraries, or home creative projects."
    })

    # 6. Evening Routine
    ev_act = "Close windows before evening traffic peak begins. Avoid open roadside food stalls near congested intersections." if eff >= 2 else "Normal evening routine. Great time for a neighbourhood walk."
    items.append({
        "phase": "Evening Routine",
        "time": "17:00 – 19:30",
        "status": "Smog Inversion Risk" if eff >= 2 else "Clear",
        "action": ev_act,
        "why": "Evening rush hour coincides with dropping ambient temperatures, concentrating vehicle exhaust close to ground level.",
        "indoor_alternative": "Indoor cooking with exhaust hood running; indoor family time."
    })

    # 7. Natural Ventilation Recommendations
    vent_act = f"Air the home briefly for 10-15 minutes during the cleanest forecast window ({vent_win}), then reseal." if eff >= 2 else "Keep windows open for continuous natural ventilation."
    items.append({
        "phase": "Ventilation Window",
        "time": vent_win,
        "status": "Strategic Airing",
        "action": vent_act,
        "why": "Controlled short airing purges indoor CO2 and cooking moisture while minimizing outdoor particulate intrusion.",
        "indoor_alternative": "Use an energy recovery ventilator (ERV) or standalone HEPA purifier on continuous mode."
    })

    # 8. Night-Time Indoor Environment Guidance
    n_act = "Keep bedroom windows closed. Run a HEPA air purifier on quiet night mode in sleeping quarters." if ind["has_purifier"] else ("Keep bedroom windows tightly closed and seal door thresholds with a draft stopper." if eff >= 2 else "Ventilate bedroom before sleep for fresh cool air.")
    items.append({
        "phase": "Night-Time Indoor Care",
        "time": "21:30 – 06:00",
        "status": "Protected Sleep",
        "action": n_act,
        "why": "Sleep represents 7-9 hours of continuous breathing in one microenvironment. Maintaining low bedroom PM2.5 aids cardiovascular recovery.",
        "indoor_alternative": "Ensure the bedroom door is closed to maintain the filtered clean air zone overnight."
    })

    return items


# ------------------------------------------------------------------ top level
def build_plan(profile: dict, air: dict) -> dict:
    """Combine air data and household profile into a complete, explainable plan."""
    hh = profile["household"]
    sensitive = is_sensitive(hh)
    cur = air["current"]
    lvl = risk_level(cur["us_aqi"], sensitive)
    hours = future_hours(air, 24)
    window = best_window(hours)
    vent_window = best_window(hours, 6, 22)
    worst = best_window(hours, 6, 21, worst=True)
    blocks = build_blocks(air, sensitive)
    trend = compute_trend(air)
    planner = planner_recs(profile, air, lvl, blocks, window)
    indoor = indoor_recs(profile, air, lvl, vent_window)
    alternatives = alternative_recs(profile, lvl)
    community = community_recs(lvl)
    alerts = build_alerts(profile, air, lvl, trend)
    daily_schedule = build_daily_schedule(profile, air, lvl, blocks, window, vent_window)
    top = sorted(planner + indoor, key=lambda r: r["priority"])[:3]
    if lvl["index"] is None:
        headline = "Current air-quality data is incomplete for this location, so advice is limited."
    else:
        who = "Your household includes sensitive members, so advice is a little more cautious. " if sensitive else ""
        adj = " Because of that, 'Moderate' air is treated with extra care." if lvl["adjusted"] else ""
        headline = f"US AQI is {lvl['aqi']} ({lvl['category']['label']}).{adj} {who}".strip()
    return {
        "air": air, "risk": {**lvl, "sensitive_household": sensitive}, "trend": trend, "alerts": alerts, "headline": headline,
        "top_actions": top,
        "planner": {
            "recommendations": planner,
            "blocks": blocks,
            "best_window": window,
            "worst_window": worst,
            "daily_schedule": daily_schedule,
        },
        "indoor": {"recommendations": indoor, "best_ventilation_window": vent_window},
        "alternatives": alternatives,
        "community": community, "profile_used": profile, "disclaimer": DISCLAIMER,
    }
