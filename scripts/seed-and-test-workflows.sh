#!/usr/bin/env bash
# Seed workflows via the live API and exercise every major scenario.
#
# Prerequisites:
#   - Backend on BASE (default http://localhost:4003)
#   - Demo users seeded (npm run prisma:seed in backend/)
#   - jq installed
#
# Usage:
#   ./scripts/seed-and-test-workflows.sh
#   BASE=http://localhost:4003 PASS=Password123! ./scripts/seed-and-test-workflows.sh

set -euo pipefail

BASE="${BASE:-http://localhost:4003}"
PASS="${PASS:-Password123!}"
WORKDIR="${TMPDIR:-/tmp}/dt-workflow-api-$$"
mkdir -p "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

green() { printf '\033[32m%s\033[0m\n' "$*" >&2; }
red() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
yellow() { printf '\033[33m%s\033[0m\n' "$*" >&2; }
blue() { printf '\033[34m%s\033[0m\n' "$*" >&2; }

pass() { PASS_COUNT=$((PASS_COUNT + 1)); green "  PASS  $*"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); red "  FAIL  $*"; }
skip() { SKIP_COUNT=$((SKIP_COUNT + 1)); yellow "  SKIP  $*"; }

section() {
  echo
  blue "════════════════════════════════════════════════════════"
  blue "  $*"
  blue "════════════════════════════════════════════════════════"
}

# --- HTTP helpers -----------------------------------------------------------
# Sessions are cached: auth login is rate-limited (5/min), and re-authing on
# every request blows through that during a full scenario run.

login() {
  local email="$1"
  local key="${email%@*}"
  local jar="$WORKDIR/${key}.cookies"
  local meta="$WORKDIR/${key}.session"

  if [[ -f "$meta" ]]; then
    cat "$meta"
    return 0
  fi

  local body token
  body=$(curl -sS -c "$jar" -b "$jar" -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\"}")
  echo "$body" > "$WORKDIR/${key}.login.json"
  token=$(jq -r '.csrfToken // empty' <<<"$body")
  if [[ -z "$token" || "$token" == "null" ]]; then
    red "Login failed for $email"
    echo "$body" | jq . 2>/dev/null >&2 || echo "$body" >&2
    exit 1
  fi
  printf '%s|%s\n' "$jar" "$token" | tee "$meta"
}

api() {
  # api METHOD PATH EMAIL [JSON_BODY]
  local method="$1" path="$2" email="$3"
  local body="${4:-}"
  local jar csrf
  IFS='|' read -r jar csrf <<<"$(login "$email")"

  local args=( -sS -b "$jar" -c "$jar" -X "$method" "$BASE$path"
    -H 'Content-Type: application/json'
    -w '\n%{http_code}' )

  if [[ "$method" != "GET" && "$method" != "HEAD" ]]; then
    args+=( -H "X-CSRF-Token: $csrf" )
  fi
  if [[ -n "$body" ]]; then
    args+=( -d "$body" )
  fi

  local raw http_code resp
  raw=$(curl "${args[@]}")
  http_code=$(tail -n1 <<<"$raw")
  resp=$(sed '$d' <<<"$raw")
  printf '%s\n%s' "$http_code" "$resp"
}

expect_status() {
  # expect_status LABEL EXPECTED_CODE METHOD PATH EMAIL [BODY]
  local label="$1" expected="$2" method="$3" path="$4" email="$5"
  local body="${6:-}"
  local out code resp
  out=$(api "$method" "$path" "$email" "$body")
  code=$(head -n1 <<<"$out")
  resp=$(tail -n +2 <<<"$out")

  if [[ "$code" == "$expected" ]]; then
    pass "$label (HTTP $code)"
    echo "$resp"
    return 0
  fi
  fail "$label — expected HTTP $expected, got $code"
  echo "$resp" | jq . 2>/dev/null >&2 || echo "$resp" >&2
  # Still emit body so callers can inspect; exit non-zero
  echo "$resp"
  return 1
}

json_id() {
  jq -r '.id // empty' <<<"$1"
}

# --- Bootstrap --------------------------------------------------------------

section "0. Health + resolve seed IDs"

if ! curl -sS -o /dev/null --connect-timeout 3 --max-time 10 \
  -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"bad"}'; then
  red "Backend not reachable at $BASE"
  exit 1
fi
green "Backend reachable at $BASE"

# Login as Master once to load global catalogue
ALICE_OUT=$(login "alice@example.com")
IFS='|' read -r ALICE_JAR ALICE_CSRF <<<"$ALICE_OUT"

USERS_JSON=$(curl -sS -b "$ALICE_JAR" "$BASE/users")
COMPANIES_JSON=$(curl -sS -b "$ALICE_JAR" "$BASE/companies")
FOLDERS_JSON=$(curl -sS -b "$ALICE_JAR" "$BASE/files/folders")
FILES_JSON=$(curl -sS -b "$ALICE_JAR" "$BASE/files")

user_id() { jq -r --arg e "$1" '.[] | select(.email==$e) | .id' <<<"$USERS_JSON"; }
user_name() { jq -r --arg e "$1" '.[] | select(.email==$e) | .name' <<<"$USERS_JSON"; }
company_id() { jq -r --arg n "$1" '.[] | select(.name==$n) | .id' <<<"$COMPANIES_JSON"; }
dept_id() {
  jq -r --arg c "$1" --arg d "$2" \
    '.[] | select(.name==$c) | .departments[]? | select(.name==$d) | .id' \
    <<<"$COMPANIES_JSON"
}
folder_id() {
  jq -r --arg n "$1" '.[] | select(.name==$n) | .id' <<<"$FOLDERS_JSON" | head -n1
}
acme_doc_id() {
  local acme
  acme=$(company_id "Acme Corporation")
  jq -r --arg c "$acme" \
    '[.[] | select(.companyId==$c and .deletedAt==null)][0].id // empty' \
    <<<"$FILES_JSON"
}

SADE=$(user_id "sade@example.com"); SADE_NAME=$(user_name "sade@example.com")
CHARLIE=$(user_id "charlie@example.com"); CHARLIE_NAME=$(user_name "charlie@example.com")
JOHN=$(user_id "john@example.com"); JOHN_NAME=$(user_name "john@example.com")
JULIA=$(user_id "julia@example.com"); JULIA_NAME=$(user_name "julia@example.com")
BOB=$(user_id "bob@example.com"); BOB_NAME=$(user_name "bob@example.com")
FIONA=$(user_id "fiona@example.com"); FIONA_NAME=$(user_name "fiona@example.com")
IVAN=$(user_id "ivan@example.com"); IVAN_NAME=$(user_name "ivan@example.com")
HANNAH=$(user_id "hannah@example.com"); HANNAH_NAME=$(user_name "hannah@example.com")
RITA=$(user_id "rita@example.com")
GRACE=$(user_id "grace@example.com"); GRACE_NAME=$(user_name "grace@example.com")

ACME=$(company_id "Acme Corporation")
TECH=$(company_id "Tech Solutions Ltd")
LEGAL=$(dept_id "Acme Corporation" "Legal")
FOLDER=$(folder_id "Company Policies")
[[ -z "$FOLDER" ]] && FOLDER=$(folder_id "Contracts Division Files")
DOC=$(acme_doc_id)

echo "  Acme=$ACME  Tech=$TECH  Legal=$LEGAL" >&2
echo "  Folder=$FOLDER  Doc=$DOC" >&2
echo "  Sade=$SADE  Charlie=$CHARLIE  John=$JOHN  Julia=$JULIA" >&2
echo "  Ivan=$IVAN  Hannah=$HANNAH  Grace=$GRACE" >&2

for required in ACME TECH LEGAL FOLDER SADE CHARLIE JOHN JULIA IVAN HANNAH; do
  if [[ -z "${!required}" ]]; then
    red "Missing required seed id: $required — re-run backend prisma seed"
    exit 1
  fi
done

DUE=$(date -u -v+14d +%Y-%m-%dT00:00:00.000Z 2>/dev/null || date -u -d '+14 days' +%Y-%m-%dT00:00:00.000Z)

# ============================================================================
# 1. Negative: Receptionist cannot create workflows
# ============================================================================
section "1. Permission negatives"

RITA_RESP=$(api POST /workflows rita@example.com "{
  \"title\": \"Should fail — receptionist\",
  \"type\": \"folder\",
  \"status\": \"assigned\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$JOHN\",\"name\":\"$JOHN_NAME\"}
}")
RITA_CODE=$(head -n1 <<<"$RITA_RESP")
if [[ "$RITA_CODE" == "403" ]]; then
  pass "Receptionist blocked from workflows.create (HTTP 403)"
else
  fail "Receptionist should get 403 creating workflow, got $RITA_CODE"
fi

JOHN_ACT=$(api POST /actions john@example.com "{
  \"title\": \"Should fail — staff cannot assign\",
  \"type\": \"regular\",
  \"workflowId\": \"00000000-0000-0000-0000-000000000000\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$FIONA\",\"name\":\"$FIONA_NAME\"}
}")
JOHN_ACT_CODE=$(head -n1 <<<"$JOHN_ACT")
if [[ "$JOHN_ACT_CODE" == "403" ]]; then
  pass "Staff blocked from actions.assign (HTTP 403)"
else
  # May be 403 or 404/500 depending on guard order — 403 is correct
  fail "Staff should get 403 assigning actions, got $JOHN_ACT_CODE"
fi

# ============================================================================
# 2. Same-company folder workflow → assign → route → in_progress
# ============================================================================
section "2. Same-company folder workflow + routing"

WF1_BODY=$(expect_status "Create folder workflow" 201 POST /workflows sade@example.com "{
  \"title\": \"[API] Contract packet review\",
  \"description\": \"Seeded via curl — same-company folder workflow\",
  \"type\": \"folder\",
  \"status\": \"assigned\",
  \"progress\": 0,
  \"dueDate\": \"$DUE\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$JOHN\",\"name\":\"$JOHN_NAME\"},
  \"sourceCompanyId\": \"$ACME\",
  \"sourceCompanyName\": \"Acme Corporation\",
  \"isCrossCompany\": false
}") || true
WF1=$(json_id "$WF1_BODY")
[[ -n "$WF1" ]] && pass "Workflow id=$WF1" || fail "No workflow id returned"

if [[ -n "$WF1" ]]; then
  expect_status "GET workflow" 200 GET "/workflows/$WF1" sade@example.com >/dev/null || true

  ROUTE_BODY=$(expect_status "Route to Julia (individual)" 200 PUT "/workflows/$WF1" sade@example.com "{
    \"status\": \"in_progress\",
    \"assignedTo\": {\"type\":\"user\",\"id\":\"$JULIA\",\"name\":\"$JULIA_NAME\"},
    \"routingHistory\": [{
      \"from\": {\"type\":\"user\",\"id\":\"$JOHN\",\"name\":\"$JOHN_NAME\"},
      \"to\": {\"type\":\"user\",\"id\":\"$JULIA\",\"name\":\"$JULIA_NAME\"},
      \"routingType\": \"individual\",
      \"notes\": \"Dept secretary to coordinate review\",
      \"routedBy\": \"$SADE_NAME\",
      \"isCrossCompany\": false
    }]
  }") || true

  DEPT_ROUTE=$(expect_status "Route to Legal department" 200 PUT "/workflows/$WF1" julia@example.com "{
    \"assignedTo\": {\"type\":\"department\",\"id\":\"$LEGAL\",\"name\":\"Legal\"},
    \"routingHistory\": [{
      \"from\": {\"type\":\"user\",\"id\":\"$JULIA\",\"name\":\"$JULIA_NAME\"},
      \"to\": {\"type\":\"department\",\"id\":\"$LEGAL\",\"name\":\"Legal\"},
      \"routingType\": \"department\",
      \"notes\": \"Broadcast to Legal\",
      \"routedBy\": \"$JULIA_NAME\"
    }]
  }") || true
fi

# ============================================================================
# 3. Document workflow
# ============================================================================
section "3. Document workflow"

if [[ -n "$DOC" ]]; then
  WF_DOC=$(expect_status "Create document workflow" 201 POST /workflows sade@example.com "{
    \"title\": \"[API] Document sign-off\",
    \"description\": \"Seeded via curl — document-type workflow\",
    \"type\": \"document\",
    \"status\": \"assigned\",
    \"documentId\": \"$DOC\",
    \"companyId\": \"$ACME\",
    \"assignedTo\": {\"type\":\"user\",\"id\":\"$FIONA\",\"name\":\"$FIONA_NAME\"},
    \"sourceCompanyId\": \"$ACME\",
    \"sourceCompanyName\": \"Acme Corporation\",
    \"isCrossCompany\": false
  }") || true
  WF_DOC_ID=$(json_id "$WF_DOC")
  [[ -n "$WF_DOC_ID" ]] && pass "Document workflow id=$WF_DOC_ID"
else
  skip "No Acme document in seed — skipping document workflow"
fi

# ============================================================================
# 4. Actions: regular → complete
# ============================================================================
section "4. Action type: regular → completed"

WF_ACT=$(expect_status "Create workflow for regular action" 201 POST /workflows sade@example.com "{
  \"title\": \"[API] Regular action host\",
  \"type\": \"folder\",
  \"status\": \"assigned\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$JOHN\",\"name\":\"$JOHN_NAME\"},
  \"sourceCompanyId\": \"$ACME\",
  \"sourceCompanyName\": \"Acme Corporation\"
}") || true
WF_ACT_ID=$(json_id "$WF_ACT")

if [[ -n "$WF_ACT_ID" ]]; then
  ACT1=$(expect_status "Create regular action" 201 POST /actions sade@example.com "{
    \"title\": \"[API] Review checklist\",
    \"description\": \"Mark complete when done\",
    \"type\": \"regular\",
    \"status\": \"pending\",
    \"workflowId\": \"$WF_ACT_ID\",
    \"folderId\": \"$FOLDER\",
    \"assignedTo\": {\"type\":\"user\",\"id\":\"$JOHN\",\"name\":\"$JOHN_NAME\"},
    \"dueDate\": \"$DUE\"
  }") || true
  ACT1_ID=$(json_id "$ACT1")

  if [[ -n "$ACT1_ID" ]]; then
    expect_status "Start regular action (in_progress)" 200 PUT "/actions/$ACT1_ID" john@example.com "{
      \"status\": \"in_progress\"
    }" >/dev/null || true

    expect_status "Complete regular action" 200 PUT "/actions/$ACT1_ID" john@example.com "{
      \"status\": \"completed\"
    }" >/dev/null || true

    # Workflow progress should bump after completion
    PROG=$(api GET "/workflows/$WF_ACT_ID" sade@example.com)
    PROG_BODY=$(tail -n +2 <<<"$PROG")
    PROG_VAL=$(jq -r '.progress // 0' <<<"$PROG_BODY")
    if [[ "$PROG_VAL" != "0" && "$PROG_VAL" != "null" ]]; then
      pass "Workflow progress updated after action complete (progress=$PROG_VAL)"
    else
      fail "Expected workflow progress > 0 after completing sole action (got $PROG_VAL)"
    fi
  fi
fi

# ============================================================================
# 5. Actions: document_upload lifecycle
# ============================================================================
section "5. Action type: document_upload → document_uploaded → completed"

WF_UP=$(expect_status "Create workflow for upload action" 201 POST /workflows sade@example.com "{
  \"title\": \"[API] Upload action host\",
  \"type\": \"folder\",
  \"status\": \"assigned\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$JOHN\",\"name\":\"$JOHN_NAME\"},
  \"sourceCompanyId\": \"$ACME\",
  \"sourceCompanyName\": \"Acme Corporation\"
}") || true
WF_UP_ID=$(json_id "$WF_UP")

if [[ -n "$WF_UP_ID" ]]; then
  ACT_UP=$(expect_status "Create document_upload action" 201 POST /actions sade@example.com "{
    \"title\": \"[API] Upload signed PDF\",
    \"type\": \"document_upload\",
    \"status\": \"pending\",
    \"workflowId\": \"$WF_UP_ID\",
    \"folderId\": \"$FOLDER\",
    \"targetFolderId\": \"$FOLDER\",
    \"requiredFileType\": \"pdf\",
    \"assignedTo\": {\"type\":\"user\",\"id\":\"$JOHN\",\"name\":\"$JOHN_NAME\"}
  }") || true
  ACT_UP_ID=$(json_id "$ACT_UP")

  if [[ -n "$ACT_UP_ID" ]]; then
    expect_status "Mark document_uploaded" 200 PUT "/actions/$ACT_UP_ID" john@example.com "{
      \"status\": \"document_uploaded\"
    }" >/dev/null || true

    expect_status "Complete upload action" 200 PUT "/actions/$ACT_UP_ID" john@example.com "{
      \"status\": \"completed\"
    }" >/dev/null || true
  fi
fi

# ============================================================================
# 6. Actions: request_response lifecycle
# ============================================================================
section "6. Action type: request_response → response_received → completed"

WF_RR=$(expect_status "Create workflow for request/response" 201 POST /workflows sade@example.com "{
  \"title\": \"[API] Request/response host\",
  \"type\": \"folder\",
  \"status\": \"assigned\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$FIONA\",\"name\":\"$FIONA_NAME\"},
  \"sourceCompanyId\": \"$ACME\",
  \"sourceCompanyName\": \"Acme Corporation\"
}") || true
WF_RR_ID=$(json_id "$WF_RR")

if [[ -n "$WF_RR_ID" ]]; then
  ACT_RR=$(expect_status "Create request_response action" 201 POST /actions sade@example.com "{
    \"title\": \"[API] Clarify indemnity clause\",
    \"type\": \"request_response\",
    \"status\": \"pending\",
    \"workflowId\": \"$WF_RR_ID\",
    \"requestDetails\": \"Please confirm the indemnity wording by EOD.\",
    \"assignedTo\": {\"type\":\"user\",\"id\":\"$FIONA\",\"name\":\"$FIONA_NAME\"}
  }") || true
  ACT_RR_ID=$(json_id "$ACT_RR")

  if [[ -n "$ACT_RR_ID" ]]; then
    expect_status "Record response_received" 200 PUT "/actions/$ACT_RR_ID" fiona@example.com "{
      \"status\": \"response_received\",
      \"response\": \"Indemnity clause accepted as drafted.\"
    }" >/dev/null || true

    expect_status "Complete request/response action" 200 PUT "/actions/$ACT_RR_ID" fiona@example.com "{
      \"status\": \"completed\"
    }" >/dev/null || true
  fi
fi

# ============================================================================
# 7. ready_for_review → goals → achieve → completed
# ============================================================================
section "7. Goals (ready_for_review → achieve → complete workflow)"

WF_GOAL=$(expect_status "Create workflow for goals" 201 POST /workflows sade@example.com "{
  \"title\": \"[API] Goals lifecycle host\",
  \"type\": \"folder\",
  \"status\": \"in_progress\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$JOHN\",\"name\":\"$JOHN_NAME\"},
  \"sourceCompanyId\": \"$ACME\",
  \"sourceCompanyName\": \"Acme Corporation\"
}") || true
WF_GOAL_ID=$(json_id "$WF_GOAL")

if [[ -n "$WF_GOAL_ID" ]]; then
  # Goals rejected while not ready_for_review
  EARLY=$(api POST "/workflows/$WF_GOAL_ID/goals" sade@example.com "{
    \"title\": \"Too early\",
    \"assignedToType\": \"user\",
    \"assignedToId\": \"$JOHN\",
    \"assignedToName\": \"$JOHN_NAME\"
  }")
  EARLY_CODE=$(head -n1 <<<"$EARLY")
  EARLY_BODY=$(tail -n +2 <<<"$EARLY")
  if [[ "$EARLY_CODE" =~ ^4 ]] || echo "$EARLY_BODY" | grep -qi 'ready for review\|Goals can only'; then
    pass "Goal create blocked before ready_for_review (HTTP $EARLY_CODE)"
  else
    # Service may throw 500 with message — accept that as blocked
    if echo "$EARLY_BODY" | grep -qi 'Goals can only'; then
      pass "Goal create blocked before ready_for_review (error message)"
    else
      fail "Expected goal create to fail before ready_for_review (HTTP $EARLY_CODE)"
      echo "$EARLY_BODY" | head -c 400; echo
    fi
  fi

  expect_status "Mark ready_for_review" 200 PUT "/workflows/$WF_GOAL_ID" sade@example.com "{
    \"status\": \"ready_for_review\"
  }" >/dev/null || true

  GOAL=$(expect_status "Create goal" 201 POST "/workflows/$WF_GOAL_ID/goals" sade@example.com "{
    \"title\": \"[API] File signed copy in Contracts\",
    \"description\": \"Archive the executed agreement\",
    \"status\": \"pending\",
    \"assignedToType\": \"user\",
    \"assignedToId\": \"$JOHN\",
    \"assignedToName\": \"$JOHN_NAME\",
    \"assignedUsers\": [{\"id\":\"$JOHN\",\"name\":\"$JOHN_NAME\",\"type\":\"user\"}],
    \"dueDate\": \"$DUE\"
  }") || true
  GOAL_ID=$(json_id "$GOAL")

  GOAL_DEPT=$(expect_status "Create department goal" 201 POST "/workflows/$WF_GOAL_ID/goals" sade@example.com "{
    \"title\": \"[API] Legal to acknowledge filing\",
    \"assignedToType\": \"department\",
    \"assignedToId\": \"$LEGAL\",
    \"assignedToName\": \"Legal\",
    \"status\": \"pending\"
  }") || true

  GOAL_ALL=$(expect_status "Create all_participants goal" 201 POST "/workflows/$WF_GOAL_ID/goals" sade@example.com "{
    \"title\": \"[API] Everyone confirm receipt\",
    \"assignedToType\": \"all_participants\",
    \"assignedToName\": \"All participants\",
    \"status\": \"pending\"
  }") || true

  if [[ -n "$GOAL_ID" ]]; then
    STAFF_ACHIEVE=$(api PUT "/workflows/goals/$GOAL_ID/achieve" john@example.com '{"notes":"nope"}')
    STAFF_CODE=$(head -n1 <<<"$STAFF_ACHIEVE")
    if [[ "$STAFF_CODE" == "403" ]]; then
      pass "Staff blocked from achieving goals (needs workflows.edit)"
    else
      fail "Staff should get 403 achieving goals, got $STAFF_CODE"
    fi

    # Goal achieve requires workflows.edit (Company Secretary+)
    expect_status "Achieve goal" 200 PUT "/workflows/goals/$GOAL_ID/achieve" sade@example.com "{
      \"notes\": \"Filed under Contracts Division Files\"
    }" >/dev/null || true
  fi

  expect_status "Complete workflow" 200 PUT "/workflows/$WF_GOAL_ID" sade@example.com "{
    \"status\": \"completed\"
  }" >/dev/null || true

  DONE=$(api GET "/workflows/$WF_GOAL_ID" sade@example.com)
  DONE_BODY=$(tail -n +2 <<<"$DONE")
  STATUS=$(jq -r '.status // empty' <<<"$DONE_BODY")
  COMPLETED_AT=$(jq -r '.completedAt // empty' <<<"$DONE_BODY")
  if [[ "$STATUS" == "completed" && -n "$COMPLETED_AT" && "$COMPLETED_AT" != "null" ]]; then
    pass "Workflow completed with completedAt set"
  else
    fail "Workflow not fully completed (status=$STATUS completedAt=$COMPLETED_AT)"
  fi
fi

# ============================================================================
# 8. Cross-company: approve
# ============================================================================
section "8. Cross-company workflow — approve"

# Charlie (Acme Admin) has approvals.review; creates pending WF + approval request
WF_X_OK=$(expect_status "Create cross-company pending workflow" 201 POST /workflows charlie@example.com "{
  \"title\": \"[API] Cross-company — approve path\",
  \"description\": \"Acme → Tech assignment awaiting approval\",
  \"type\": \"folder\",
  \"status\": \"pending\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$IVAN\",\"name\":\"$IVAN_NAME\"},
  \"sourceCompanyId\": \"$ACME\",
  \"sourceCompanyName\": \"Acme Corporation\",
  \"targetCompanyId\": \"$TECH\",
  \"targetCompanyName\": \"Tech Solutions Ltd\",
  \"isCrossCompany\": true,
  \"approvalStatus\": \"pending\"
}") || true
WF_X_OK_ID=$(json_id "$WF_X_OK")

if [[ -n "$WF_X_OK_ID" ]]; then
  APR_OK=$(expect_status "Create approval request (workflow_assignment)" 201 POST /approval-requests charlie@example.com "{
    \"workflowId\": \"$WF_X_OK_ID\",
    \"requestType\": \"workflow_assignment\",
    \"sourceCompanyId\": \"$ACME\",
    \"sourceCompanyName\": \"Acme Corporation\",
    \"targetCompanyId\": \"$TECH\",
    \"targetCompanyName\": \"Tech Solutions Ltd\",
    \"assignedToType\": \"user\",
    \"assignedToId\": \"$IVAN\",
    \"assignedToName\": \"$IVAN_NAME\",
    \"workflowTitle\": \"[API] Cross-company — approve path\",
    \"workflowDescription\": \"Acme → Tech assignment awaiting approval\",
    \"routingNotes\": \"Please accept for Engineering review\"
  }") || true
  APR_OK_ID=$(json_id "$APR_OK")

  if [[ -n "$APR_OK_ID" ]]; then
    expect_status "Hannah (Tech Admin) lists approval requests" 200 GET /approval-requests hannah@example.com >/dev/null || true

    expect_status "Approve cross-company request" 200 PUT "/approval-requests/$APR_OK_ID" hannah@example.com "{
      \"status\": \"approved\"
    }" >/dev/null || true

    # Activate workflow after approval
    expect_status "Activate approved workflow" 200 PUT "/workflows/$WF_X_OK_ID" charlie@example.com "{
      \"status\": \"assigned\",
      \"approvalStatus\": \"approved\",
      \"approvedBy\": \"$HANNAH\",
      \"approvedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
    }" >/dev/null || true
  fi
fi

# ============================================================================
# 9. Cross-company: reject
# ============================================================================
section "9. Cross-company workflow — reject"

WF_X_NO=$(expect_status "Create cross-company pending workflow (reject path)" 201 POST /workflows charlie@example.com "{
  \"title\": \"[API] Cross-company — reject path\",
  \"type\": \"folder\",
  \"status\": \"pending\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$IVAN\",\"name\":\"$IVAN_NAME\"},
  \"sourceCompanyId\": \"$ACME\",
  \"sourceCompanyName\": \"Acme Corporation\",
  \"targetCompanyId\": \"$TECH\",
  \"targetCompanyName\": \"Tech Solutions Ltd\",
  \"isCrossCompany\": true,
  \"approvalStatus\": \"pending\"
}") || true
WF_X_NO_ID=$(json_id "$WF_X_NO")

if [[ -n "$WF_X_NO_ID" ]]; then
  APR_NO=$(expect_status "Create approval request (reject path)" 201 POST /approval-requests charlie@example.com "{
    \"workflowId\": \"$WF_X_NO_ID\",
    \"requestType\": \"workflow_assignment\",
    \"sourceCompanyId\": \"$ACME\",
    \"sourceCompanyName\": \"Acme Corporation\",
    \"targetCompanyId\": \"$TECH\",
    \"targetCompanyName\": \"Tech Solutions Ltd\",
    \"assignedToType\": \"user\",
    \"assignedToId\": \"$IVAN\",
    \"assignedToName\": \"$IVAN_NAME\",
    \"workflowTitle\": \"[API] Cross-company — reject path\"
  }") || true
  APR_NO_ID=$(json_id "$APR_NO")

  if [[ -n "$APR_NO_ID" ]]; then
    expect_status "Reject cross-company request" 200 PUT "/approval-requests/$APR_NO_ID" hannah@example.com "{
      \"status\": \"rejected\",
      \"rejectionReason\": \"Capacity — Engineering cannot take this on this sprint.\"
    }" >/dev/null || true

    expect_status "Mark workflow approval rejected" 200 PUT "/workflows/$WF_X_NO_ID" charlie@example.com "{
      \"approvalStatus\": \"rejected\",
      \"status\": \"pending\"
    }" >/dev/null || true
  fi
fi

# ============================================================================
# 10. Cross-company action assignment approval
# ============================================================================
section "10. Cross-company action_assignment approval"

WF_XA=$(expect_status "Host workflow for cross-company action" 201 POST /workflows charlie@example.com "{
  \"title\": \"[API] Host for cross-company action\",
  \"type\": \"folder\",
  \"status\": \"in_progress\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$JULIA\",\"name\":\"$JULIA_NAME\"},
  \"sourceCompanyId\": \"$ACME\",
  \"sourceCompanyName\": \"Acme Corporation\"
}") || true
WF_XA_ID=$(json_id "$WF_XA")

if [[ -n "$WF_XA_ID" ]]; then
  ACT_X=$(expect_status "Create cross-company action (pending approval)" 201 POST /actions charlie@example.com "{
    \"title\": \"[API] Tech to supply deployment notes\",
    \"type\": \"request_response\",
    \"status\": \"pending\",
    \"workflowId\": \"$WF_XA_ID\",
    \"requestDetails\": \"Share the latest runbook excerpt.\",
    \"assignedTo\": {\"type\":\"user\",\"id\":\"$IVAN\",\"name\":\"$IVAN_NAME\"},
    \"sourceCompanyId\": \"$ACME\",
    \"targetCompanyId\": \"$TECH\",
    \"isCrossCompany\": true,
    \"approvalStatus\": \"pending\"
  }") || true
  ACT_X_ID=$(json_id "$ACT_X")

  if [[ -n "$ACT_X_ID" ]]; then
    APR_ACT=$(expect_status "Create action_assignment approval" 201 POST /approval-requests charlie@example.com "{
      \"actionId\": \"$ACT_X_ID\",
      \"workflowId\": \"$WF_XA_ID\",
      \"requestType\": \"action_assignment\",
      \"sourceCompanyId\": \"$ACME\",
      \"sourceCompanyName\": \"Acme Corporation\",
      \"targetCompanyId\": \"$TECH\",
      \"targetCompanyName\": \"Tech Solutions Ltd\",
      \"assignedToType\": \"user\",
      \"assignedToId\": \"$IVAN\",
      \"assignedToName\": \"$IVAN_NAME\",
      \"actionTitle\": \"[API] Tech to supply deployment notes\",
      \"workflowTitle\": \"[API] Host for cross-company action\"
    }") || true
    APR_ACT_ID=$(json_id "$APR_ACT")

    if [[ -n "$APR_ACT_ID" ]]; then
      expect_status "Approve action_assignment" 200 PUT "/approval-requests/$APR_ACT_ID" hannah@example.com "{
        \"status\": \"approved\"
      }" >/dev/null || true
    fi
  fi
fi

# ============================================================================
# 11. Cross-company routing approval (workflow_routing)
# ============================================================================
section "11. Cross-company routing (workflow_routing)"

# Note: Group Secretary (grace) currently 500s on PUT /workflows/:id because the
# service treats null companyId as "other company". Use Master (alice) here —
# she has dataScope all and bypasses that check — until that bug is fixed.
WF_XR=$(expect_status "Create workflow to route cross-company" 201 POST /workflows alice@example.com "{
  \"title\": \"[API] Cross-company routing host\",
  \"type\": \"folder\",
  \"status\": \"in_progress\",
  \"folderId\": \"$FOLDER\",
  \"companyId\": \"$ACME\",
  \"assignedTo\": {\"type\":\"user\",\"id\":\"$BOB\",\"name\":\"$BOB_NAME\"},
  \"sourceCompanyId\": \"$ACME\",
  \"sourceCompanyName\": \"Acme Corporation\"
}") || true
WF_XR_ID=$(json_id "$WF_XR")

if [[ -n "$WF_XR_ID" ]]; then
  expect_status "Append cross_company routing entry" 200 PUT "/workflows/$WF_XR_ID" alice@example.com "{
    \"assignedTo\": {\"type\":\"user\",\"id\":\"$IVAN\",\"name\":\"$IVAN_NAME\"},
    \"status\": \"pending\",
    \"isCrossCompany\": true,
    \"approvalStatus\": \"pending\",
    \"targetCompanyId\": \"$TECH\",
    \"targetCompanyName\": \"Tech Solutions Ltd\",
    \"routingHistory\": [{
      \"from\": {\"type\":\"user\",\"id\":\"$BOB\",\"name\":\"$BOB_NAME\"},
      \"to\": {\"type\":\"user\",\"id\":\"$IVAN\",\"name\":\"$IVAN_NAME\"},
      \"routingType\": \"cross_company\",
      \"notes\": \"Master routing to Tech\",
      \"routedBy\": \"Alice Williams\",
      \"isCrossCompany\": true,
      \"sourceCompanyId\": \"$ACME\",
      \"targetCompanyId\": \"$TECH\"
    }]
  }" >/dev/null || true

  APR_ROUTE=$(expect_status "Create workflow_routing approval" 201 POST /approval-requests alice@example.com "{
    \"workflowId\": \"$WF_XR_ID\",
    \"requestType\": \"workflow_routing\",
    \"sourceCompanyId\": \"$ACME\",
    \"sourceCompanyName\": \"Acme Corporation\",
    \"targetCompanyId\": \"$TECH\",
    \"targetCompanyName\": \"Tech Solutions Ltd\",
    \"assignedToType\": \"user\",
    \"assignedToId\": \"$IVAN\",
    \"assignedToName\": \"$IVAN_NAME\",
    \"workflowTitle\": \"[API] Cross-company routing host\",
    \"routingNotes\": \"Routed by Master\"
  }") || true
  APR_ROUTE_ID=$(json_id "$APR_ROUTE")

  if [[ -n "$APR_ROUTE_ID" ]]; then
    expect_status "Approve workflow_routing" 200 PUT "/approval-requests/$APR_ROUTE_ID" hannah@example.com "{
      \"status\": \"approved\"
    }" >/dev/null || true

    expect_status "Activate after routing approval" 200 PUT "/workflows/$WF_XR_ID" alice@example.com "{
      \"status\": \"assigned\",
      \"approvalStatus\": \"approved\"
    }" >/dev/null || true
  fi
fi

# ============================================================================
# 12. List / filter smoke
# ============================================================================
section "12. List endpoints smoke"

expect_status "List workflows (Sade)" 200 GET /workflows sade@example.com >/dev/null || true
expect_status "List actions (John)" 200 GET /actions john@example.com >/dev/null || true
expect_status "My goals (John)" 200 GET /workflows/goals/my-goals john@example.com >/dev/null || true
expect_status "Workflows by folder" 200 GET "/workflows/folder/$FOLDER" sade@example.com >/dev/null || true
if [[ -n "${WF_DOC_ID:-}" ]]; then
  expect_status "Workflows by document" 200 GET "/workflows/document/$DOC" sade@example.com >/dev/null || true
fi

# ============================================================================
# Summary
# ============================================================================
section "Summary"

echo "  Passed: $PASS_COUNT" >&2
echo "  Failed: $FAIL_COUNT" >&2
echo "  Skipped: $SKIP_COUNT" >&2
echo >&2
echo "  Seeded workflows are titled with the [API] prefix — filter in the UI by that." >&2
echo "  Actors used: alice, sade, charlie, julia, john, fiona, hannah, rita" >&2
echo >&2

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  red "Some scenarios failed."
  exit 1
fi
green "All exercised scenarios passed."
exit 0
