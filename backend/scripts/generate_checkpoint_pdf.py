#!/usr/bin/env python3
"""Generates SAMSKARA_CHECKPOINTS_TE.pdf — checkpoints for each of the 16 Shodasa Samskaras + Antyeshti, in Telugu."""
import json, urllib.request, html
from datetime import date

BASE = "http://127.0.0.1:8555"
FONT = "/tmp/NotoSansTelugu-Regular.ttf"

# Fetch the registry from the live API
with urllib.request.urlopen(f"{BASE}/muhurta/samskaras/list") as r:
    samskaras = json.load(r)

COMMON_CHECKS = [
    ("వార శుద్ధి", "శుభ వారము ఎంపిక; నిషిద్ధ వారములు వర్జింపబడును (ఉదా: మంగళ, శనివారములు)"),
    ("తిథి శుద్ధి", "ఋక్త తిథులు (4, 9, 14), అమావాస్య మరియు తైతిల నిషిద్ధ తిథులు వర్జింపబడును"),
    ("నక్షత్ర శుద్ధి", "ఆ సంస్కారమునకు ప్రసిద్ధి చెందిన శుభ నక్షత్రములు మాత్రమే స్వీకరింపబడును"),
    ("లగ్న శుద్ధి", "శుభ లగ్నము (వృషభ, మిథున, కర్కాటక, కన్య, ధను, మీన లగ్నములు) శ్రేష్ఠము; లగ్నమున పాపగ్రహములు ఉండరాదు (లగ్న శుద్ధి)"),
    ("అష్టమ శుద్ధి", "ముహూర్త లగ్నము నుండి 8వ స్థానము (అష్టమము) గ్రహరహితముగా ఉండవలెను"),
    ("తారాబలం", "జన్మ నక్షత్రమునుండి గణించు నవతారలు — జన్మ, విపత్ (3), ప్రత్యరి (5), వధ (7) తారలు నిషిద్ధం; సంపత్, క్షేమ, సాధ్య, మిత్ర, పరమ మిత్ర తారలు శుభం"),
    ("చంద్రబలం / చంద్రాష్టమము", "తరుణుని జన్మరాశి నుండి ముహూర్త చంద్ర 1,3,6,7,10,11 స్థానములు శుభం; 8వ స్థానము = చంద్రాష్టమము — అత్యంత నిషిద్ధం"),
    ("పంచక రహితం", "(తిథి + వారం + నక్షత్రం + లగ్నం) % 9 = 5 అయినచో పంచకము లేని దినము — శుభం; పంచకములో 'మృత్యు'/'అగ్ని' శున్య అనే ఇతర పంచకాలు వర్జ్యం"),
    ("పుష్కరాంశ / పుష్కర భాగం", "లగ్నము పుష్కరాంశ లేదా పుష్కర భాగములో ఉండిన సమస్త దోషాలు శాంతించును — అత్యుత్తమ కాలం"),
    ("2 మహాదోష పరీక్ష (21)", "ముహూర్త సమయ D1 పట్టికపై 21 ఏకవింశతి మహాదోషలు (సంక్రాంతి, పాపపడ్వర్గ, కర్తరి, లగ్నశస్త్ర, గండాంత, వ్యతీపాత/వైదृతి మొదలగునవి) నిర్ధారింపబడును"),
    ("దశవిధ దోష పరీక్ష (10)", "లత్తా, పాత, యుతి, వేద, జామిత్ర, మృత పంచక, ఏకార్గళ, ఉపగ్రహ, క్రాంతి సామ్య, దగ్ధ తిథి — 10 దోషములు నిర్ధారింపబడును"),
    ("పరిహార పరీక్ష", "గురు కేంద్ర దృష్టి, పుష్కర, అభిజిత్, పంచక శాస్త్ర, అష్టమ లగ్న పరిహారముల ద్వారా దోష నివృత్తి గలదా అని పరీక్షింపబడును"),
    ("రాహు/గుళిక/యమగండ/దుర్ముహూర్త వర్జన", "ముహూర్త కాలము రాహుకాలం, యమగండం, గుళిక కాలం, దుర్ముహూర్తం, వర్జ్యం లలో తగిలినయెడల వర్జింపబడును"),
]

SPECIAL_LABELS = {
    "chandrashtama_both": ("వధూవరుల (భర్త-భార్యల) చంద్రాష్టమ పరీక్ష", "భర్త గానీ భార్య గానీ జన్మరాశి నుండి 8వ ఇంట చంద్రుడు ఉండరాదు"),
    "ritu_lagna_6_8": ("ఋతు లగ్న 6/8 పరీక్ష", "వధువు ప్రథమ ఋతు లగ్నానికి ముహూర్త లగ్నం 6వ గానీ 8వ గానీ ఉండరాదు"),
    "star_7_prohibited": ("7వ నక్షత్ర నిషేధం", "జన్మ నక్షత్రమునుండి 7వ నక్షత్రం (విపత్ తార) ఏ కార్యానికీ నిషిద్ధం"),
    "month_3_pregnancy": ("3వ గర్భ మాస పరీక్ష", "తొలి గర్భము గల వనితకు 3వ మాసమునందే పుంసవనము చేయవలెను"),
    "ashtama_lagna": ("అష్టమ లగ్న నిషేధం", "జన్మ లగ్నము నుండి ముహూర్త లగ్నం 8వ లగ్నంగా ఉండరాదు"),
    "navama_shuddhi": ("నవమ శుద్ధి", "ముహూర్త లగ్నము నుండి 9వ స్థానము గ్రహరహితముగా ఉండవలెను"),
    "dashama_shuddhi": ("దశమ శుద్ధి", "ముహూర్త లగ్నము నుండి 10వ స్థానము ఖాళీగా ఉండవలెను"),
    "gender_parity": ("లింగ భేద మాస నియమము", "పుత్రులకు సరి మాసములు, పుత్రికలకు బేసి మాసములు — ఆ సంస్కార పద్ధతిననుసరించి"),
    "uttarayana_only": ("ఉత్తరాయణ పరీక్ష", "సూర్యుడు మకర–మిథున రాశులలో (ఉత్తరాయణము) ఉండవలెను — దక్షిణాయనము వర్జ్యం"),
    "guru_strength": ("గురు బల పరీక్ష", "బృహస్పతి (గురుడు) కేంద్ర గానీ కోణ గానీ బలముగా (మకరరాశి కాక) ఉండవలెను"),
    "kendras_clean": ("కేంద్ర శుచిత్వ పరీక్ష", "ముహూర్త లగ్నము నుండి కేంద్రముల (1,4,7,10) పాపగ్రహములు ఉండరాదు"),
    "daytime_only": ("పగటివేళ పరీక్ష", "ఈ సంస్కారము సూర్యోదయ–సూర్యాస్తమయ సమయములలో (పగటివేళ) మాత్రమే చేయుదగినది"),
    "guru_shukra_avastha": ("గురు-శుక్ర అవస్థ పరీక్ష", "ముహూర్త సమయమున గురుడు గానీ శుక్రుడు గానీ అస్తమించి (అస్తగత) గానీ వక్రగతిన గానీ ఉండరాదు"),
    "trijashta_star": ("త్రిజేష్ఠ నక్షత్ర పరీక్ష", "వధువు జన్మ నక్షత్రమునుండి గణించిన 18వ (త్రిజేష్ఠ) నక్షత్రము వర్జ్యం"),
    "vivaha_masas": ("మాస శుద్ధి పరీక్ష", "ఆషాఢ, శ్రావణ, భాద్రపద, పుష్య చంద్రమాన మాసములు వివాహానికి నిషిద్ధ; ఏకాదశి/శుభ మాసములు శ్రేష్టం"),
}

ANTYESHTI_CHECKS = [
    ("తిథి నిర్ణయము", "దహనార్థము ఏకాదశి తిథి వర్జ్యం; మరణ దినమున లేనిచో తరువాతి తిథి-శుద్ధమైన దినమున చేయుదురు"),
    ("సపిండీకరణము", "12వ దినము ముఖ్యము — తిథి రహితముగా ఉన్నచో తరువాతి దినములన గణింపబడును"),
    ("అస్థి సంచయము", "3వ దినము (లేనిచో 4వ దినము) అస్థి సంగ్రహము చేయుదురు"),
    ("సంక్రాంతి పుణ్యకాలము", "సంక్రాంతి దినముల గుర్తింపు — పితృకార్యమునకు పుణ్యకాలము"),
    ("అష్టకా శ్రాద్ధము", "కృష్ణ పక్ష అష్టమి తిథి దినముల నుండి వార్షిక అష్టక శ్రాద్ధ దినముల లెక్కింపు"),
    ("తిలోదక / వసోదక విధానము", "దహనానంతర 10 దినములలో నిత్యము తిలోదక, వసోదక విధానము"),
]

def esc(s): return html.escape(str(s or ""))

rows = []
for s in samskaras:
    checks = list(COMMON_CHECKS)
    for sc in s.get("special_checks", []):
        if sc in SPECIAL_LABELS:
            checks.append(SPECIAL_LABELS[sc])
    check_html = "".join(
        f"<tr><td class='c1'>{esc(name)}</td><td class='c2'>{esc(desc)}</td></tr>" for name, desc in checks
    )
    rows.append(f"""
      <section class="card">
        <h2><span class="icon">{esc(s['icon'])}</span> {esc(s['name_te'])} <span class="en">({esc(s['name_en'])})</span></h2>
        <p class="tagline">{esc(s['tagline_te'])}</p>
        <p class="rules">{esc(s['rules_summary_te'])}</p>
        <table>
          <thead><tr><th>పరీక్షాంశము (Check point)</th><th>వివరణ</th></tr></thead>
          <tbody>{check_html}</tbody>
        </table>
      </section>
    """)

antyeshti_html = "".join(f"<tr><td class='c1'>{esc(n)}</td><td class='c2'>{esc(d)}</td></tr>" for n, d in ANTYESHTI_CHECKS)
cards = "\n".join(rows)

html_doc = f"""<!DOCTYPE html><html lang="te"><head><meta charset="utf-8"><style>
  @font-face {{ font-family: 'NotoTelugu'; src: url('file://{FONT}'); }}
  body {{ font-family: 'NotoTelugu','Telugu Sangam MN',sans-serif; direction: ltr; margin: 28px 30px; }}
  h1 {{ text-align:center; font-size:20px; margin:0 0 4px; }}
  .sub {{ text-align:center; color:#555; font-size:11px; margin-bottom:18px; }}
  section.card {{ border:1px solid #ddd; border-radius:8px; padding:12px 16px; margin-bottom:14px; page-break-inside: avoid; }}
  h2 {{ font-size:15px; margin:0 0 4px; color:#7b1f00; }} h2 .en {{ color:#666; font-size:11px; font-weight:400; }}
  .tagline {{ color:#444; font-size:11px; margin:0 0 6px; }}
  .rules {{ font-size:11.5px; background:#fff8ee; border:1px solid #f0ddb8; border-radius:6px; padding:6px 10px; margin:0 0 8px; }}
  table {{ width:100%; border-collapse:collapse; font-size:11px; }}
  th {{ background:#7b1f00; color:#fff; padding:4px 8px; text-align:left; }}
  td {{ border-bottom:1px solid #eee; padding:4px 8px; vertical-align:top; }}
  td.c1 {{ width:24%; font-weight:600; color:#3b2200; }}
  .foot {{ text-align:center; color:#888; font-size:10px; margin-top:16px; }}
</style></head><body>
<h1>షోడశ సంస్కారముల — ముహూర్త పరీక్షాంశములు (చెక్ పాయింట్లు)</h1>
<p class="sub">జ్యోతిష్య గ్రంథము (Dr. Vamsee Nemani · గాయత్రి జ్యోతిర్నిధి) ఆధారితము — ముహూర్తమ్-ఆప్ ఇంజన్ నిర్ధారణలు · {date.today().strftime('%d-%m-%Y')}</p>
{cards}
<section class="card">
<h2><span class="icon">🕯️</span> అంత్యేష్టి / పితృక్రియ <span class="en">(Antyeshti / Pitrukarya Engine)</span></h2>
<p class="tagline">లగ్న-ఆధారితము కాదు — తిథి-ఆధారిత నిర్ణయము (తెలిసిన దినము నుండి)</p>
<table><thead><tr><th>పరీక్షాంశము</th><th>వివరణ</th></tr></thead><tbody>{antyeshti_html}</tbody></table>
</section>
<p class="foot">ఈ పరీక్షాంశములు SAMSKARA_REGISTRY + doshas_engine + panchang యందు ప్రతి ముహూర్త కిటికీపై స్వయంచాలకంగా పరుగునెక్కించుబడును · API: /muhurta/samskara-finder · /muhurta/pitrukarya-finder</p>
</body></html>"""

from weasyprint import HTML
HTML(string=html_doc, base_url=".").write_pdf("/Users/karrthikuuuuu/Documents/Projects/Muhurtham-App/SAMSKARA_CHECKPOINTS_TE.pdf")
print("PDF written: SAMSKARA_CHECKPOINTS_TE.pdf")
