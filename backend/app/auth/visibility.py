"""
Which muhurtas are shown (plan R12, decision V1).

The super admin hides tabs, single events, or the Shraddha calendar tool. Stored in
app_settings as `catalog_visibility` = {"hidden_tabs": [...], "hidden_events": [...], "hidden_tools": [...]}.

  users                 hidden items disappear from the catalog, and searches for them are refused
  admins, super admin   see everything, with each hidden item marked "hidden" (to check it first)

An event is hidden when it is hidden itself, or when every tab it appears in is hidden.
The rule files are never changed.
"""
from typing import Any, Dict, List, Optional, Set

from .app_settings import get_setting
from .permissions import has_permission

SETTING = "catalog_visibility"
TOOLS = {"pitru_calendar": {"en": "Shraddha calendar (Pitru tab)", "te": "శ్రాద్ధ తిథి నిర్ణయం (పితృకర్మ)"}}
NOT_AVAILABLE = "This muhurta is not available right now."


def current() -> Dict[str, Set[str]]:
    raw = get_setting(SETTING) or {}
    return {k: set(raw.get(k) or []) for k in ("hidden_tabs", "hidden_events", "hidden_tools")}


def sees_hidden(user: Optional[dict]) -> bool:
    """Admins and the super admin see hidden items (marked). Direct in-process calls pass no user."""
    return not isinstance(user, dict) or has_permission(user, "admin.dashboard")


def _tabs_of(rule: Dict[str, Any]) -> List[str]:
    return [rule.get("tab") or rule.get("category")] + list(rule.get("also_in") or [])


def event_hidden(rule: Dict[str, Any], vis: Dict[str, Set[str]]) -> bool:
    return rule["id"] in vis["hidden_events"] or all(t in vis["hidden_tabs"] for t in _tabs_of(rule))


def tool_hidden(tool: str, vis: Dict[str, Set[str]]) -> bool:
    if tool == "yogas":
        return "yogas" in vis["hidden_tabs"]
    if tool == "pitru_calendar":
        return tool in vis["hidden_tools"] or "pitru" in vis["hidden_tabs"]
    return False


def is_event_allowed(activity_id: str, rules: List[Dict[str, Any]], user: Optional[dict]) -> bool:
    if sees_hidden(user):
        return True
    rule = next((r for r in rules if r["id"] == activity_id), None)
    return rule is None or not event_hidden(rule, current())   # unknown ids get the usual "not found"


def is_tool_allowed(tool: str, user: Optional[dict]) -> bool:
    return sees_hidden(user) or not tool_hidden(tool, current())


def apply_to_catalog(rules: List[Dict[str, Any]], tabs: List[Dict[str, Any]], user: Optional[dict]) -> Dict[str, Any]:
    """Users get only what is shown; admins get everything with `hidden` marks."""
    vis = current()
    staff = sees_hidden(user)
    out_rules, out_tabs = [], []
    for r in rules:
        hidden = event_hidden(r, vis)
        if hidden and not staff:
            continue
        out_rules.append({**r, "hidden": hidden})          # copy: the rule list is cached
    shown_ids = {r["id"] for r in out_rules}
    for t in tabs:
        hidden = t["id"] in vis["hidden_tabs"]
        events = [e for e in t["events"] if staff or (e in shown_ids and not hidden)]
        if not staff and (hidden or (not events and t["id"] != "yogas")):
            continue
        out_tabs.append({**t, "events": events, "count": len(events), "hidden": hidden})
    tools_hidden = sorted(k for k in TOOLS if tool_hidden(k, vis))
    return {"rules": out_rules, "tabs": out_tabs,
            "hidden_tools": tools_hidden if not staff else [],
            "hidden_tools_marked": tools_hidden if staff else []}
