"""Feature engineering (TRD section 7.2): one row per crop x mandi x week.

Every feature at week t uses only information available at t, except
`rain_next2`, which stands for the 2-week rain forecast: in training it is the
rain that actually fell (a perfect-forecast assumption, noted in the model
card); at prediction time it comes from the stored forecast rows.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalogue import CROP_IDS, MANDIS, get_mandi
from app.models import MarketPrice, WeatherRecord

HORIZONS = [4, 8, 12]
PRIMARY_HORIZON = 8
MANDI_IDS = [m["id"] for m in MANDIS]
# Approximate Diwali dates; the four weeks before are flagged as festival demand.
DIWALI = ["2020-11-14", "2021-11-04", "2022-10-24", "2023-11-12", "2024-11-01", "2025-10-20", "2026-11-08", "2027-10-29", "2028-10-17"]

BASE_FEATURES = [
    "ret_1", "ret_2", "ret_4", "ret_8", "ret_52", "ma4_ratio", "ma12_ratio", "vol_8", "seas_dev",
    "arr_anom", "arr_anom_4w", "arr_chg_4",
    "rain8_anom", "rain26_anom", "tmax_4", "rain_next2",
    "woy_sin", "woy_cos", "season", "festival", "crop_code", "mandi_code",
]
HORIZON_FEATURE = "seas_exp"  # last year's log price change over the same span
FEATURES = BASE_FEATURES + [HORIZON_FEATURE]
CATEGORICAL = ["crop_code", "mandi_code", "season"]
RAIN_FEATURES = ["rain8_anom", "rain26_anom", "rain_next2"]


def _monday(dates: pd.Series) -> pd.Series:
    d = pd.to_datetime(dates)
    return d - pd.to_timedelta(d.dt.weekday, unit="D")


def load_weekly_prices(db: Session) -> pd.DataFrame:
    rows = db.execute(select(MarketPrice.crop_id, MarketPrice.mandi_id, MarketPrice.date, MarketPrice.modal_price, MarketPrice.arrivals_t, MarketPrice.source)).all()
    if not rows:
        return pd.DataFrame(columns=["crop_id", "mandi_id", "week", "price", "arrivals", "n_days", "source"])
    df = pd.DataFrame(rows, columns=["crop_id", "mandi_id", "date", "modal", "arrivals", "source"])
    df["week"] = _monday(df["date"])
    return (
        df.groupby(["crop_id", "mandi_id", "week"], as_index=False)
        .agg(price=("modal", "mean"), arrivals=("arrivals", lambda s: s.sum(min_count=1)), n_days=("modal", "size"), source=("source", "first"))
        .sort_values(["crop_id", "mandi_id", "week"])
    )


def load_weekly_weather(db: Session) -> pd.DataFrame:
    rows = db.execute(select(WeatherRecord.district_id, WeatherRecord.date, WeatherRecord.rain_mm, WeatherRecord.tmax_c)).all()
    if not rows:
        return pd.DataFrame(columns=["district_id", "week", "rain", "tmax"])
    df = pd.DataFrame(rows, columns=["district_id", "date", "rain", "tmax"])
    df["week"] = _monday(df["date"])
    return df.groupby(["district_id", "week"], as_index=False).agg(rain=("rain", "sum"), tmax=("tmax", "mean"))


def _same_week_normal(s: pd.Series) -> pd.Series:
    """Mean of the value 1, 2 and 3 years earlier (whatever is available)."""
    return pd.concat([s.shift(52), s.shift(104), s.shift(156)], axis=1).mean(axis=1, skipna=True)


def _weather_features(w: pd.DataFrame) -> pd.DataFrame:
    w = w.sort_values("week").set_index("week")
    full = pd.date_range(w.index.min(), w.index.max(), freq="W-MON")
    w = w.reindex(full)
    rain8 = w["rain"].rolling(8, min_periods=4).sum()
    rain26 = w["rain"].rolling(26, min_periods=13).sum()
    out = pd.DataFrame(index=full)
    # +20 mm keeps the ratio stable in the dry season, when the normal is close to zero.
    out["rain8_anom"] = (rain8 - _same_week_normal(rain8)) / (_same_week_normal(rain8) + 20)
    out["rain26_anom"] = (rain26 - _same_week_normal(rain26)) / (_same_week_normal(rain26) + 20)
    out["tmax_4"] = w["tmax"].rolling(4, min_periods=2).mean()
    out["rain_next2"] = w["rain"].shift(-1) + w["rain"].shift(-2)
    out.index.name = "week"
    return out.reset_index()


def build_panel(prices: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    """Returns the feature panel with targets y_<h> = log(price[t+h] / price[t])."""
    if prices.empty:
        return pd.DataFrame()
    wx = {d: _weather_features(g) for d, g in weather.groupby("district_id")} if not weather.empty else {}
    festival_weeks = set()
    for d in DIWALI:
        monday = pd.Timestamp(d) - pd.Timedelta(days=pd.Timestamp(d).weekday())
        festival_weeks.update(monday - pd.Timedelta(weeks=k) for k in range(0, 4))

    frames = []
    for (crop, mandi), g in prices.groupby(["crop_id", "mandi_id"]):
        if crop not in CROP_IDS or mandi not in MANDI_IDS:
            continue
        g = g.set_index("week").sort_index()
        full = pd.date_range(g.index.min(), g.index.max(), freq="W-MON")
        g = g.reindex(full)
        p = g["price"].astype(float)
        lp = np.log(p)
        arr = g["arrivals"].astype(float)
        f = pd.DataFrame(index=full)
        f["crop_id"], f["mandi_id"] = crop, mandi
        f["district_id"] = get_mandi(mandi)["districtId"]
        f["price"] = p
        for k in (1, 2, 4, 8, 52):
            f[f"ret_{k}"] = lp - lp.shift(k)
        f["ma4_ratio"] = lp - np.log(p.rolling(4, min_periods=2).mean())
        f["ma12_ratio"] = lp - np.log(p.rolling(12, min_periods=6).mean())
        f["vol_8"] = f["ret_1"].rolling(8, min_periods=4).std()
        f["seas_dev"] = lp - np.log(_same_week_normal(p))
        arr3 = arr.rolling(3, min_periods=1).mean()
        f["arr_anom"] = arr3 / _same_week_normal(arr3) - 1
        f["arr_anom_4w"] = f["arr_anom"].rolling(4, min_periods=2).mean()
        arr4 = arr.rolling(4, min_periods=2).mean()
        f["arr_chg_4"] = np.log(arr4 / arr4.shift(4))
        woy = full.isocalendar().week.to_numpy().astype(float)
        f["woy_sin"], f["woy_cos"] = np.sin(2 * np.pi * woy / 52), np.cos(2 * np.pi * woy / 52)
        month = full.month
        f["season"] = np.where((month >= 6) & (month <= 9), 0, np.where((month >= 3) & (month <= 5), 2, 1))
        f["festival"] = [1 if wk in festival_weeks else 0 for wk in full]
        f["crop_code"] = CROP_IDS.index(crop)
        f["mandi_code"] = MANDI_IDS.index(mandi)
        for h in HORIZONS:
            f[f"y_{h}"] = lp.shift(-h) - lp
            f[f"seas_exp_{h}"] = lp.shift(52 - h) - lp.shift(52)
            f[f"naive_{h}"] = p.shift(52 - h)  # seasonal-naive forecast of price[t+h]
        f.index.name = "week"
        f = f.reset_index()
        district_wx = wx.get(f["district_id"].iloc[0])
        if district_wx is not None:
            f = f.merge(district_wx, on="week", how="left")
        else:
            for col in ("rain8_anom", "rain26_anom", "tmax_4", "rain_next2"):
                f[col] = np.nan
        frames.append(f)
    if not frames:
        return pd.DataFrame()
    panel = pd.concat(frames, ignore_index=True).replace([np.inf, -np.inf], np.nan)
    for c in CATEGORICAL:
        panel[c] = panel[c].astype(int)
    return panel


def design_matrix(panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    X = panel[BASE_FEATURES].copy()
    X[HORIZON_FEATURE] = panel[f"seas_exp_{horizon}"]
    return X[FEATURES]


def season_of(week: pd.Timestamp) -> str:
    return "kharif" if 6 <= week.month <= 9 else "zaid" if 3 <= week.month <= 5 else "rabi"
