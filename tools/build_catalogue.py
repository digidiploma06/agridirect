"""Single source of truth for crops, districts and mandis.

Run from the repository root after editing this file:

    python tools/build_catalogue.py

It writes backend/app/catalogue_data.json and frontend/lib/mock/catalogue.data.json
(identical content) and refreshes the crop and district names in
frontend/messages/{en,hi,mr}.json.

The agronomy numbers (zone affinity, water need, soil preference) are
indicative rules of thumb for Maharashtra's agro-climatic zones. They are a
starting point and should be reviewed by an agronomist before real use.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# zone key -> (label, typical annual rainfall in mm, reference soil)
ZONES = {
    "konkan": ("Konkan coast", 2800, {"ph": 5.8, "organic_carbon_g_kg": 11.0, "clay_pct": 30, "texture": "clay loam"}),
    "ghat": ("Western Ghat transition", 850, {"ph": 7.3, "organic_carbon_g_kg": 7.0, "clay_pct": 38, "texture": "clay loam"}),
    "scarcity": ("Scarcity zone", 560, {"ph": 8.1, "organic_carbon_g_kg": 4.8, "clay_pct": 46, "texture": "clay"}),
    "assured": ("Assured rainfall", 780, {"ph": 7.9, "organic_carbon_g_kg": 5.5, "clay_pct": 48, "texture": "clay"}),
    "khandesh": ("Khandesh", 700, {"ph": 7.8, "organic_carbon_g_kg": 5.2, "clay_pct": 44, "texture": "clay"}),
    "central": ("Central Vidarbha", 950, {"ph": 7.7, "organic_carbon_g_kg": 5.8, "clay_pct": 50, "texture": "clay"}),
    "eastern": ("Eastern Vidarbha", 1350, {"ph": 6.4, "organic_carbon_g_kg": 7.5, "clay_pct": 32, "texture": "clay loam"}),
}
Z = ["konkan", "ghat", "scarcity", "assured", "khandesh", "central", "eastern"]

# id, en, hi, mr, family, seasons, days, water, good soils, poor soils, affinity per zone (order of Z),
# base price Rs/q, weekly sigma, seasonal amplitude, price-peak week, supply beta, base weekly arrivals (t), Agmarknet names
CROPS = [
    ("rice", "Rice (paddy)", "धान", "भात", "cereal", ["kharif"], 130, "high", ["alluvial", "laterite", "red"], [], [1, .6, 0, .2, .2, .4, 1], 2400, .012, .04, 30, .25, 900, ["Paddy(Dhan)(Common)", "Rice"]),
    ("wheat", "Wheat", "गेहूँ", "गहू", "cereal", ["rabi"], 120, "medium", ["black", "alluvial"], ["laterite"], [0, .7, .5, .7, .8, .8, .5], 2700, .012, .04, 46, .25, 700, ["Wheat"]),
    ("jowar", "Jowar (sorghum)", "ज्वार", "ज्वारी", "cereal", ["kharif", "rabi"], 115, "low", ["black"], ["laterite"], [0, .5, 1, .9, .7, .6, .3], 3000, .018, .05, 34, .3, 380, ["Jowar(Sorghum)"]),
    ("bajra", "Bajra (pearl millet)", "बाजरा", "बाजरी", "cereal", ["kharif"], 85, "low", ["red", "black"], ["laterite"], [0, .5, 1, .6, .8, .2, 0], 2500, .018, .05, 28, .3, 300, ["Bajra(Pearl Millet/Cumbu)"]),
    ("maize", "Maize", "मक्का", "मका", "cereal", ["kharif", "rabi", "zaid"], 110, "medium", ["black", "alluvial"], [], [.2, .8, .8, .7, .9, .6, .5], 2100, .020, .06, 30, .35, 420, ["Maize"]),
    ("gram", "Gram (chana)", "चना", "हरभरा", "pulse", ["rabi"], 105, "low", ["black"], ["laterite"], [0, .6, .8, .9, .8, .9, .6], 5800, .015, .05, 44, .3, 260, ["Bengal Gram(Gram)(Whole)"]),
    ("tur", "Tur (pigeon pea)", "अरहर (तूर)", "तूर", "pulse", ["kharif"], 170, "low", ["black"], ["laterite"], [.1, .5, .8, 1, .7, 1, .6], 7200, .015, .05, 26, .3, 90, ["Arhar (Tur/Red Gram)(Whole)", "Arhar(Tur/Red Gram)(Whole)", "Tur"]),
    ("moong", "Moong (green gram)", "मूँग", "मूग", "pulse", ["kharif", "zaid"], 70, "low", ["black", "red"], [], [.1, .5, .7, .9, .8, .7, .4], 7800, .016, .05, 22, .3, 70, ["Green Gram (Moong)(Whole)"]),
    ("urad", "Urad (black gram)", "उड़द", "उडीद", "pulse", ["kharif"], 80, "low", ["black"], [], [.2, .5, .6, .9, .8, .7, .4], 7000, .016, .05, 24, .3, 60, ["Black Gram (Urd Beans)(Whole)"]),
    ("soybean", "Soybean", "सोयाबीन", "सोयाबीन", "oilseed", ["kharif"], 100, "medium", ["black"], ["laterite"], [0, .7, .5, 1, .6, 1, .5], 4600, .016, .05, 28, .3, 260, ["Soyabean", "Soybean"]),
    ("groundnut", "Groundnut", "मूँगफली", "भुईमूग", "oilseed", ["kharif", "zaid"], 115, "medium", ["red", "alluvial"], [], [.3, .8, .7, .6, .7, .4, .3], 6200, .015, .05, 24, .3, 150, ["Groundnut"]),
    ("sunflower", "Sunflower", "सूरजमुखी", "सूर्यफूल", "oilseed", ["kharif", "rabi"], 95, "low", ["black"], ["laterite"], [0, .4, .8, .9, .5, .5, .2], 6000, .016, .05, 30, .3, 60, ["Sunflower"]),
    ("cotton", "Cotton", "कपास", "कापूस", "fibre", ["kharif"], 170, "medium", ["black"], ["laterite"], [0, .2, .5, .9, 1, 1, .4], 7200, .015, .04, 30, .25, 500, ["Cotton"]),
    ("sugarcane", "Sugarcane", "गन्ना", "ऊस", "cash", ["kharif", "rabi"], 365, "high", ["black", "alluvial"], ["laterite"], [.1, 1, .7, .6, .5, .2, .2], 340, .004, .01, 20, .05, 6000, ["Sugarcane"]),
    ("onion", "Onion", "प्याज़", "कांदा", "vegetable", ["kharif", "rabi"], 130, "high", ["black", "alluvial"], [], [.1, .9, 1, .6, .8, .4, .2], 1800, .060, .22, 40, .9, 1900, ["Onion"]),
    ("tomato", "Tomato", "टमाटर", "टोमॅटो", "vegetable", ["kharif", "rabi", "zaid"], 120, "high", ["red", "alluvial", "black"], [], [.4, .9, .6, .6, .6, .6, .5], 1500, .075, .26, 27, .95, 640, ["Tomato"]),
    ("potato", "Potato", "आलू", "बटाटा", "vegetable", ["rabi"], 95, "medium", ["alluvial", "red"], [], [0, .9, .5, .4, .4, .4, .3], 1600, .040, .15, 44, .6, 500, ["Potato"]),
    ("chilli", "Chilli (dry red)", "मिर्च", "मिरची", "spice", ["kharif", "rabi"], 160, "medium", ["black", "red"], [], [.4, .6, .6, .7, .9, .8, .8], 14000, .030, .10, 34, .5, 80, ["Chili Red", "Dry Chillies"]),
    ("turmeric", "Turmeric", "हल्दी", "हळद", "spice", ["kharif"], 250, "high", ["red", "alluvial", "black"], [], [.4, .8, .4, .9, .5, .7, .5], 13000, .030, .10, 36, .5, 120, ["Turmeric"]),
    ("garlic", "Garlic", "लहसुन", "लसूण", "spice", ["rabi"], 140, "medium", ["black", "alluvial"], [], [0, .8, .7, .5, .6, .4, .2], 9000, .050, .18, 42, .7, 90, ["Garlic"]),
]
# Rain-fed paddy is normal in these zones, so "rainfed" is not a risk for rice there.
RAINFED_OK = {"rice": ["konkan", "eastern", "ghat"]}

# slug, en, hi, mr, lat, lng, zone, other spellings. Centroids are approximate.
DISTRICTS = [
    ("ahilyanagar", "Ahilyanagar", "अहिल्यानगर", "अहिल्यानगर", 19.09, 74.74, "scarcity", ["Ahmednagar", "Ahmadnagar"]),
    ("akola", "Akola", "अकोला", "अकोला", 20.71, 77.00, "central", []),
    ("amravati", "Amravati", "अमरावती", "अमरावती", 20.93, 77.75, "central", ["Amarawati"]),
    ("beed", "Beed", "बीड", "बीड", 18.99, 75.76, "scarcity", ["Bid"]),
    ("bhandara", "Bhandara", "भंडारा", "भंडारा", 21.17, 79.65, "eastern", []),
    ("buldhana", "Buldhana", "बुलढाणा", "बुलढाणा", 20.53, 76.18, "central", ["Buldana"]),
    ("chandrapur", "Chandrapur", "चंद्रपुर", "चंद्रपूर", 19.95, 79.30, "eastern", []),
    ("sambhajinagar", "Chhatrapati Sambhajinagar", "छत्रपति संभाजीनगर", "छत्रपती संभाजीनगर", 19.88, 75.34, "assured", ["Aurangabad", "Chattrapati Sambhajinagar"]),
    ("dharashiv", "Dharashiv", "धाराशिव", "धाराशिव", 18.19, 76.04, "scarcity", ["Osmanabad"]),
    ("dhule", "Dhule", "धुले", "धुळे", 20.90, 74.77, "khandesh", []),
    ("gadchiroli", "Gadchiroli", "गढ़चिरौली", "गडचिरोली", 20.18, 80.00, "eastern", []),
    ("gondia", "Gondia", "गोंदिया", "गोंदिया", 21.46, 80.20, "eastern", ["Gondiya"]),
    ("hingoli", "Hingoli", "हिंगोली", "हिंगोली", 19.72, 77.15, "assured", []),
    ("jalgaon", "Jalgaon", "जलगाँव", "जळगाव", 21.00, 75.56, "khandesh", []),
    ("jalna", "Jalna", "जालना", "जालना", 19.84, 75.88, "assured", []),
    ("kolhapur", "Kolhapur", "कोल्हापुर", "कोल्हापूर", 16.70, 74.24, "ghat", []),
    ("latur", "Latur", "लातूर", "लातूर", 18.40, 76.58, "assured", []),
    ("mumbai-city", "Mumbai City", "मुंबई शहर", "मुंबई शहर", 18.96, 72.82, "konkan", ["Mumbai"]),
    ("mumbai-suburban", "Mumbai Suburban", "मुंबई उपनगर", "मुंबई उपनगर", 19.13, 72.88, "konkan", []),
    ("nagpur", "Nagpur", "नागपुर", "नागपूर", 21.15, 79.09, "central", []),
    ("nanded", "Nanded", "नांदेड़", "नांदेड", 19.15, 77.32, "assured", []),
    ("nandurbar", "Nandurbar", "नंदुरबार", "नंदुरबार", 21.50, 74.25, "khandesh", []),
    ("nashik", "Nashik", "नाशिक", "नाशिक", 20.00, 73.79, "ghat", ["Nasik"]),
    ("palghar", "Palghar", "पालघर", "पालघर", 19.70, 72.90, "konkan", []),
    ("parbhani", "Parbhani", "परभणी", "परभणी", 19.27, 76.77, "assured", []),
    ("pune", "Pune", "पुणे", "पुणे", 18.52, 73.86, "ghat", []),
    ("raigad", "Raigad", "रायगढ़", "रायगड", 18.40, 73.15, "konkan", ["Raigarh"]),
    ("ratnagiri", "Ratnagiri", "रत्नागिरी", "रत्नागिरी", 17.20, 73.45, "konkan", []),
    ("sangli", "Sangli", "सांगली", "सांगली", 16.95, 74.60, "scarcity", []),
    ("satara", "Satara", "सातारा", "सातारा", 17.68, 74.00, "ghat", []),
    ("sindhudurg", "Sindhudurg", "सिंधुदुर्ग", "सिंधुदुर्ग", 16.10, 73.70, "konkan", []),
    ("solapur", "Solapur", "सोलापुर", "सोलापूर", 17.66, 75.91, "scarcity", ["Sholapur"]),
    ("thane", "Thane", "ठाणे", "ठाणे", 19.30, 73.10, "konkan", []),
    ("wardha", "Wardha", "वर्धा", "वर्धा", 20.75, 78.60, "central", []),
    ("washim", "Washim", "वाशिम", "वाशिम", 20.11, 77.13, "central", []),
    ("yavatmal", "Yavatmal", "यवतमाल", "यवतमाळ", 20.39, 78.12, "central", ["Yeotmal"]),
]
# One main market yard per district. The two Mumbai districts have no yard of
# their own here, so they use the state-level fallback.
MANDI_OVERRIDES = {"pune": ("m-pune", "Pune (Gultekdi)", ["Pune", "Pune(Gultekdi)"]), "nashik": ("m-lasalgaon", "Lasalgaon", ["Lasalgaon"])}
NO_MANDI = {"mumbai-city", "mumbai-suburban"}
TRADED_MIN_AFFINITY = 0.4  # a crop is traded at a district's mandi when it is commonly grown there


def build() -> dict:
    crops = []
    for (cid, en, hi, mr, family, seasons, days, water, soils, avoid, aff, price, sigma, amp, peak, beta, arrivals, names) in CROPS:
        crops.append(
            {
                "id": cid, "family": family, "seasons": seasons, "durationDays": days, "agmarknetCode": "", "agmarknetNames": names,
                "water": water, "soils": soils, "avoidSoils": avoid, "rainfedOkZones": RAINFED_OK.get(cid, []),
                "zones": dict(zip(Z, aff)),
                "market": {"basePrice": price, "weeklySigma": sigma, "seasonAmp": amp, "peakWeek": peak, "supplyBeta": beta, "baseArrivalsT": arrivals},
            }
        )
    districts, mandis = [], []
    for slug, en, hi, mr, lat, lng, zone, aliases in DISTRICTS:
        label, rain, soil = ZONES[zone]
        did = f"d-{slug}"
        districts.append({"id": did, "name": en, "state": "Maharashtra", "centroid": {"lat": lat, "lng": lng}, "zone": label, "zoneKey": zone, "annualRainMm": rain, "aliases": [en, *aliases], "soil": soil})
        if slug in NO_MANDI:
            continue
        mid, name, m_aliases = MANDI_OVERRIDES.get(slug, (f"m-{slug}", en, [en, *aliases]))
        traded = [c["id"] for c in crops if c["zones"][zone] >= TRADED_MIN_AFFINITY]
        mandis.append({"id": mid, "name": name, "districtId": did, "location": {"lat": lat, "lng": lng}, "aliases": m_aliases, "crops": traded})
    return {"crops": crops, "districts": districts, "mandis": mandis}


def main() -> None:
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    for target in (ROOT / "backend" / "app" / "catalogue_data.json", ROOT / "frontend" / "lib" / "mock" / "catalogue.data.json"):
        target.write_text(text, encoding="utf-8")
    names = {"en": 1, "hi": 2, "mr": 3}
    for loc, idx in names.items():
        path = ROOT / "frontend" / "messages" / f"{loc}.json"
        raw = path.read_text(encoding="utf-8")
        messages = json.loads(raw)
        messages["crops"] = {c[0]: c[idx] for c in CROPS}
        messages["districts"] = {f"d-{d[0]}": d[idx] for d in DISTRICTS}
        path.write_text(json.dumps(messages, ensure_ascii=False, indent=2 if raw.startswith('{\n  "') else 4) + "\n", encoding="utf-8")
    series = sum(len(m["crops"]) for m in data["mandis"])
    print(f"{len(data['crops'])} crops, {len(data['districts'])} districts, {len(data['mandis'])} mandis, {series} crop x mandi series")


if __name__ == "__main__":
    main()
