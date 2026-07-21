import sys, os
sys.path.insert(0, r"c:\Users\Monad\Documents\learning\Projects\Muhurtham-App")
from backend.app.drik_panchang import compute_drik_panchang
import datetime

d = datetime.date(2026, 8, 4)
p = compute_drik_panchang(d, 16.5062, 80.6480, 5.5, "Vijayawada")
print("Sunrise:", p["sunrise"], "Sunset:", p["sunset"])
print("Rahu:", p.get("rahu_kalam"))
print("Yama:", p.get("yamagandam"))
print("Gulika:", p.get("gulika_kalam"))
print("Durmuhurtam:", p.get("durmuhurtam"))
print("Varjyam:", p.get("varjyam"))
