"""
Generic Declarative Rule Interpreter Engine (Layer 3).
Loads YAML rules from backend/app/rules/{category}/{event_id}.yaml and evaluates them
against the muhurta timeline (plan M21 pipeline):

  1. Build each day's lagna windows, split wherever tithi, nakshatra, yoga, karana or
     Moon rashi changes, so every segment is judged by the limbs running at that time.
  2. Apply the event's hard filters (vara, tithi, nakshatra, yoga, karana, lagna, houses,
     panchaka, participant balas).
  3. Subtract the bad periods the rule asks to avoid (Rahu, Yama, Gulika, Durmuhurta,
     and varjyam from the book's ghati table).
  4. Evaluate the 21 Mahadoshas and 10 Dashavidha doshas for each remaining window.
     Strict: a failed 'fatal' Mahadosha excludes the window. Lenient: it is kept with
     a visible warning and a score penalty.
  5. Score, attach the reason trail, rank.

Components (21 Nov 2026), each importing only from the ones before it:
  rules_loader: Rule files: find, merge (extends), validate, compile and list the muhurta rules.
  planets: Planet helpers: weakness, travel checks, upanayana strengths, year lord, hora lord, planet rules.
  pushkara: Pushkara navamsha / bhaga and amsha inside a window; lagna clipped to a window.
  window_rules: One lagna segment against the event's own rules: the five angas, lagna, houses, planets, balas.
  dosha_rulings: Dr. Nemani's dosha rulings applied to the computed doshas: benefics in the lagna (A7), severity, audit banner, doshapavada, whole-lagna judging (A4) and duplicates (A5).
  scoring: How the percentage is made (A8): which dosha sets count, their weights, share of checks passed.
  search: The search: per-day caches, the day loop, building each candidate and its detail, summaries.
Every name is re-exported here, so `from app.engines.rule_interpreter import X` keeps working.
"""
from app.engines.rule_interpreter.rules_loader import (  # noqa: F401
    COMBUST_ORB,
    CompiledRule,
    LUNAR_MONTH_INDEX,
    PLANET_KEYS,
    RULES_ROOT,
    SHUNYA_MASA,
    TITHI_RIKTA,
    VAARA_MAP,
    _CATALOG_CACHE,
    _COMPILED_CACHE,
    _OWN_KEYS,
    _RULES_CACHE,
    _deep_merge,
    _hms_to_hours,
    _masa,
    _rule_file,
    compile_rule,
    list_all_rules,
    load_rule,
    resolve_raw_rule,
)
from app.engines.rule_interpreter.planets import (  # noqa: F401
    DEBILITATION,
    NAKSHATRA_SHULA,
    RITU_NIGHTS,
    TRAVEL_PURPOSE_LAGNAS,
    VARA_SHULA,
    VARNESHA,
    VEDADHIPATI,
    VENUS_EAST_FORBIDS,
    VENUS_WEST_FORBIDS,
    _EXALT,
    _GURU_BAD_SIGNS,
    _GURU_GOOD_SIGNS,
    _MOON_SIGN,
    _OWN,
    _PID,
    _WEEKDAY_LORD,
    _hora_lord,
    _planet_rule_check,
    _planet_weak,
    _planets_by_name,
    _travel_check,
    _ugadi,
    _upanayana_planet,
    _upanayana_strength,
    samvatsara_lord,
)
from app.engines.rule_interpreter.pushkara import (  # noqa: F401
    AMSHA_NAMES,
    _bhaga_moments,
    lagna_for_window,
    pushkara_text,
    window_amsha,
    window_pushkara,
)
from app.engines.rule_interpreter.window_rules import (  # noqa: F401
    ANGA_NAMES,
    anga_checks,
    evaluate_window_for_rule,
)
from app.engines.rule_interpreter.dosha_rulings import (  # noqa: F401
    DASHAVIDHA_SAME_AS_MAHA,
    LAGNA_BENEFICS,
    TO_CONFIRM,
    _BENEFIC_TE,
    _LAGNA_EXTRA_IDS,
    _NOT_LAGNA_DOSHA,
    _PANCHANGA_MISS_WORDS,
    _PLANET_BY_ID,
    _STATUS_RANK,
    _is_panchanga_miss,
    _lagna_dosha_rows,
    _mark_duplicates,
    _merge_lagna_rows,
    apply_author_severity,
    benefics_in_lagna,
    dosha_audit,
    doshapavada,
    except_by_benefics,
)
from app.engines.rule_interpreter.scoring import (  # noqa: F401
    DASHAVIDHA_EVENTS,
    DASHAVIDHA_WEIGHT,
    PANCHANGA_WEIGHT,
    _share,
    default_dosha_sets,
    dosha_scoring_for,
)
from app.engines.rule_interpreter.search import (  # noqa: F401
    MOUDHYA_TE,
    NAIMITTIKA_ANADHYAYA,
    NITYA_ANADHYAYA,
    SANKRANTI_ANADHYAYA,
    TARABALA_PARAM_KEYS,
    TIME_PREFERENCES,
    TRISHTAKA,
    _DAY_CACHE_SIZE,
    _PUSHKARA_CACHE,
    _REASON_GROUPS,
    _age_allowed,
    _age_tier,
    _anadhyaya_reason,
    _birth_display,
    _build_candidate,
    _clip_preference,
    _clip_time_of_day,
    _day_lagnas,
    _day_level_reject,
    _day_panchang,
    _day_periods,
    _day_pushkara,
    _fmt,
    _kartari_mode,
    _ordinal_age,
    _parse_date,
    _reason_key,
    _result_detail,
    _window_summary,
    find_muhurta_windows,
)
