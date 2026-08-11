#!/usr/bin/env bash
# Bootstrap Nigerian / international contracts demo via real HTTP API calls.
#
# Prerequisites:
#   1. Backend running on BASE (default http://localhost:4003)
#   2. DB seeded with admin only:  cd backend && npx prisma migrate reset --force
#      (then seed creates aisha@example.com / Password123!)
#
# Usage:
#   ./scripts/bootstrap-contracts-api.sh

set -euo pipefail

BASE="${BASE:-http://localhost:4003}"
PASS="${PASS:-Password123!}"
ADMIN_EMAIL="${ADMIN_EMAIL:-aisha@example.com}"
WORKDIR="${TMPDIR:-/tmp}/dt-bootstrap-$$"
mkdir -p "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

green() { printf '\033[32m%s\033[0m\n' "$*" >&2; }
red() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
blue() { printf '\033[34m%s\033[0m\n' "$*" >&2; }

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
  token=$(jq -r '.csrfToken // empty' <<<"$body")
  if [[ -z "$token" || "$token" == "null" ]]; then
    red "Login failed for $email"
    echo "$body" >&2
    exit 1
  fi
  printf '%s|%s\n' "$jar" "$token" | tee "$meta" >/dev/null
  printf '%s|%s\n' "$jar" "$token"
}

api() {
  local method="$1" path="$2" email="$3"
  local body="${4:-}"
  local jar csrf
  IFS='|' read -r jar csrf <<<"$(login "$email")"
  local args=( -sS -b "$jar" -c "$jar" -X "$method" "$BASE$path"
    -H 'Content-Type: application/json' -w '\n%{http_code}' )
  if [[ "$method" != "GET" ]]; then
    args+=( -H "X-CSRF-Token: $csrf" )
  fi
  if [[ -n "$body" ]]; then
    args+=( -d "$body" )
  fi
  local raw code resp
  raw=$(curl "${args[@]}")
  code=$(tail -n1 <<<"$raw")
  resp=$(sed '$d' <<<"$raw")
  if [[ ! "$code" =~ ^2 ]]; then
    red "FAIL $method $path → HTTP $code"
    echo "$resp" | jq . 2>/dev/null >&2 || echo "$resp" >&2
    exit 1
  fi
  echo "$resp"
}

upload_pdf() {
  local email="$1" company_id="$2" folder_id="$3" file_path="$4"
  local scope="${5:-division}" dept="${6:-}" div="${7:-}"
  local jar csrf
  IFS='|' read -r jar csrf <<<"$(login "$email")"
  local args=( -sS -b "$jar" -c "$jar" -X POST "$BASE/files/upload"
    -H "X-CSRF-Token: $csrf" -w '\n%{http_code}'
    -F "file=@${file_path};type=application/pdf"
    -F "scopeLevel=${scope}"
    -F "folderId=${folder_id}"
    -F "companyId=${company_id}"
  )
  if [[ -n "$dept" ]]; then
    args+=( -F "departmentId=${dept}" )
  fi
  if [[ -n "$div" ]]; then
    args+=( -F "divisionId=${div}" )
  fi
  local raw code resp
  raw=$(curl "${args[@]}")
  code=$(tail -n1 <<<"$raw")
  resp=$(sed '$d' <<<"$raw")
  if [[ ! "$code" =~ ^2 ]]; then
    red "FAIL upload $(basename "$file_path") → HTTP $code"
    echo "$resp" >&2
    exit 1
  fi
  echo "$resp"
}

blue "═══ 1. Login as admin ═══"
login "$ADMIN_EMAIL" >/dev/null
green "Logged in as $ADMIN_EMAIL"

blue "═══ 2. Load roles ═══"
ROLES=$(api GET /roles "$ADMIN_EMAIL")
role_id() { jq -r --arg n "$1" '.[] | select(.name==$n) | .id' <<<"$ROLES"; }

RID_GS=$(role_id "Group Secretary")
RID_CS=$(role_id "Company Secretary")
RID_CA=$(role_id "Company Admin")
RID_DH=$(role_id "Department Head")
RID_DS=$(role_id "Department Secretary")
RID_DV=$(role_id "Division Head")
RID_MG=$(role_id "Manager")
RID_ST=$(role_id "Staff")
RID_RC=$(role_id "Receptionist")
green "Roles loaded"

blue "═══ 3. Create companies (with departments / divisions) ═══"
AREWA=$(api POST /companies "$ADMIN_EMAIL" '{
  "name": "Arewa Contract Services Ltd",
  "departments": [
    {
      "name": "Legal",
      "description": "Contracts, counsel and compliance",
      "divisions": [
        { "name": "Nigerian Contracts", "description": "MDAs, states and private-sector NG" },
        { "name": "International Partners", "description": "Multilateral and bilateral" }
      ]
    },
    {
      "name": "Administration",
      "description": "Registry and front office",
      "divisions": []
    },
    {
      "name": "Finance",
      "description": "Disbursements against contracts",
      "divisions": [
        { "name": "Disbursements", "description": "Milestone payments" }
      ]
    }
  ]
}')
AREWA_ID=$(jq -r .id <<<"$AREWA")
LEGAL_ID=$(jq -r '.departments[] | select(.name=="Legal") | .id' <<<"$AREWA")
ADMIN_DEPT_ID=$(jq -r '.departments[] | select(.name=="Administration") | .id' <<<"$AREWA")
FIN_ID=$(jq -r '.departments[] | select(.name=="Finance") | .id' <<<"$AREWA")
NG_DIV=$(jq -r '.departments[] | select(.name=="Legal") | .divisions[] | select(.name=="Nigerian Contracts") | .id' <<<"$AREWA")
INTL_DIV=$(jq -r '.departments[] | select(.name=="Legal") | .divisions[] | select(.name=="International Partners") | .id' <<<"$AREWA")
DISB_DIV=$(jq -r '.departments[] | select(.name=="Finance") | .divisions[] | select(.name=="Disbursements") | .id' <<<"$AREWA")
green "Arewa=$AREWA_ID"

GDP=$(api POST /companies "$ADMIN_EMAIL" '{
  "name": "Global Development Partners Nigeria",
  "departments": [
    {
      "name": "Programmes",
      "description": "Country programme contracts",
      "divisions": [
        { "name": "Implementing Partners", "description": "IP agreements and MoUs" }
      ]
    }
  ]
}')
GDP_ID=$(jq -r .id <<<"$GDP")
PROG_ID=$(jq -r '.departments[] | select(.name=="Programmes") | .id' <<<"$GDP")
IP_DIV=$(jq -r '.departments[] | select(.name=="Programmes") | .divisions[] | select(.name=="Implementing Partners") | .id' <<<"$GDP")
green "GDP=$GDP_ID"

blue "═══ 4. Create users via API ═══"
create_user() {
  local email="$1" name="$2" role_id="$3" company_id="$4"
  local dept_json="${5:-[]}" div_json="${6:-[]}"
  api POST /users "$ADMIN_EMAIL" "$(jq -n \
    --arg email "$email" --arg name "$name" --arg password "$PASS" \
    --arg roleId "$role_id" --arg companyId "$company_id" \
    --argjson departmentIds "$dept_json" --argjson divisionIds "$div_json" \
    '{email:$email,name:$name,password:$password,roleId:$roleId,companyId:$companyId,departmentIds:$departmentIds,divisionIds:$divisionIds,status:"active"}')" >/dev/null
  green "  + $email  $name"
}

create_user fatima@example.com "Fatima Bello" "$RID_GS" "$AREWA_ID" '[]' '[]'
create_user habiba@example.com "Habiba Musa" "$RID_CS" "$AREWA_ID" '[]' '[]'
create_user maryam@example.com "Maryam Ibrahim" "$RID_CS" "$GDP_ID" '[]' '[]'
create_user yusuf@example.com "Yusuf Abdullahi" "$RID_CA" "$AREWA_ID" "[\"$LEGAL_ID\"]" '[]'
create_user halima@example.com "Halima Sani" "$RID_CA" "$GDP_ID" "[\"$PROG_ID\"]" '[]'
create_user abubakar@example.com "Abubakar Lawal" "$RID_DH" "$AREWA_ID" "[\"$LEGAL_ID\"]" '[]'
create_user zainab@example.com "Zainab Mohammed" "$RID_DH" "$AREWA_ID" "[\"$ADMIN_DEPT_ID\"]" '[]'
create_user hadiza@example.com "Hadiza Aliyu" "$RID_DS" "$AREWA_ID" "[\"$LEGAL_ID\"]" '[]'
create_user usman@example.com "Usman Garba" "$RID_DV" "$AREWA_ID" "[\"$LEGAL_ID\"]" "[\"$NG_DIV\"]"
create_user amina@example.com "Amina Shehu" "$RID_MG" "$AREWA_ID" "[\"$ADMIN_DEPT_ID\"]" '[]'
create_user ibrahim@example.com "Ibrahim Sani" "$RID_ST" "$AREWA_ID" "[\"$LEGAL_ID\"]" "[\"$NG_DIV\"]"
create_user nafisa@example.com "Nafisa Umar" "$RID_ST" "$AREWA_ID" "[\"$LEGAL_ID\"]" "[\"$INTL_DIV\"]"
create_user suleiman@example.com "Suleiman Bello" "$RID_ST" "$AREWA_ID" "[\"$FIN_ID\"]" "[\"$DISB_DIV\"]"
create_user kabiru@example.com "Kabiru Hassan" "$RID_ST" "$GDP_ID" "[\"$PROG_ID\"]" "[\"$IP_DIV\"]"
create_user rukayya@example.com "Rukayya Adamu" "$RID_RC" "$AREWA_ID" '[]' '[]'

blue "═══ 5. Folder tree (Arewa) via API as Habiba ═══"
# Company Secretary has a home company — folders inherit it.
mkfolder() {
  local email="$1" name="$2" desc="$3" scope="$4"
  local parent="${5:-}" dept="${6:-}" div="${7:-}" company="${8:-}"
  local payload
  payload=$(jq -n \
    --arg name "$name" --arg description "$desc" --arg scopeLevel "$scope" \
    --arg parentFolderId "$parent" --arg departmentId "$dept" \
    --arg divisionId "$div" --arg companyId "$company" \
    '{
      name:$name, description:$description, scopeLevel:$scopeLevel
    }
    + (if $parentFolderId != "" then {parentFolderId:$parentFolderId} else {} end)
    + (if $departmentId != "" then {departmentId:$departmentId} else {} end)
    + (if $divisionId != "" then {divisionId:$divisionId} else {} end)
    + (if $companyId != "" then {companyId:$companyId} else {} end)')
  api POST /files/folders "$email" "$payload"
}

ROOT=$(mkfolder habiba@example.com "Contracts Registry" "Root registry for executed and draft contracts" company "" "$LEGAL_ID" "" "")
ROOT_ID=$(jq -r .id <<<"$ROOT")
green "  Contracts Registry"

NG=$(mkfolder habiba@example.com "Nigerian Contracts" "Domestic MDAs, states and private sector" department "$ROOT_ID" "$LEGAL_ID" "" "")
NG_ID=$(jq -r .id <<<"$NG")

MDA=$(mkfolder habiba@example.com "MDAs & State Governments" "Federal MDAs and northern state contracts" division "$NG_ID" "$LEGAL_ID" "$NG_DIV" "")
MDA_ID=$(jq -r .id <<<"$MDA")

PRIV=$(mkfolder habiba@example.com "Private Sector (NG)" "Nigerian companies and cooperatives" division "$NG_ID" "$LEGAL_ID" "$NG_DIV" "")
PRIV_ID=$(jq -r .id <<<"$PRIV")

INTL=$(mkfolder habiba@example.com "International Partners" "Multilateral and bilateral instruments" department "$ROOT_ID" "$LEGAL_ID" "" "")
INTL_ID=$(jq -r .id <<<"$INTL")

MULTI=$(mkfolder habiba@example.com "Multilaterals" "World Bank, AfDB, UN agencies" division "$INTL_ID" "$LEGAL_ID" "$INTL_DIV" "")
MULTI_ID=$(jq -r .id <<<"$MULTI")

BILAT=$(mkfolder habiba@example.com "Bilateral" "Embassy and bilateral agency agreements" division "$INTL_ID" "$LEGAL_ID" "$INTL_DIV" "")
BILAT_ID=$(jq -r .id <<<"$BILAT")

TMPL=$(mkfolder habiba@example.com "Templates" "Reusable Nigerian and international templates" company "$ROOT_ID" "$LEGAL_ID" "" "")
TMPL_ID=$(jq -r .id <<<"$TMPL")
green "  Nested contracts tree created"

blue "═══ 6. GDP folders via Maryam ═══"
GDP_ROOT=$(mkfolder maryam@example.com "Country Programme Contracts" "GDP Nigeria implementing-partner agreements" company "" "$PROG_ID" "" "")
GDP_ROOT_ID=$(jq -r .id <<<"$GDP_ROOT")
IP=$(mkfolder maryam@example.com "Implementing Partners" "Active IP contracts" division "$GDP_ROOT_ID" "$PROG_ID" "$IP_DIV" "")
IP_ID=$(jq -r .id <<<"$IP")
green "  GDP tree created"

blue "═══ 7. Generate + upload contract PDFs ═══"
PDF_DIR="$WORKDIR/pdfs"
mkdir -p "$PDF_DIR"
BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
(cd "$BACKEND_DIR" && NODE_PATH="$BACKEND_DIR/node_modules" node "$SCRIPT_DIR/make-demo-pdfs.js" "$PDF_DIR")

upload_pdf habiba@example.com "$AREWA_ID" "$MDA_ID" "$PDF_DIR/kano.pdf" division "$LEGAL_ID" "$NG_DIV" >/dev/null
upload_pdf habiba@example.com "$AREWA_ID" "$MDA_ID" "$PDF_DIR/fmard.pdf" division "$LEGAL_ID" "$NG_DIV" >/dev/null
upload_pdf habiba@example.com "$AREWA_ID" "$PRIV_ID" "$PDF_DIR/dangote.pdf" division "$LEGAL_ID" "$NG_DIV" >/dev/null
upload_pdf habiba@example.com "$AREWA_ID" "$MULTI_ID" "$PDF_DIR/wb.pdf" division "$LEGAL_ID" "$INTL_DIV" >/dev/null
upload_pdf habiba@example.com "$AREWA_ID" "$MULTI_ID" "$PDF_DIR/unicef.pdf" division "$LEGAL_ID" "$INTL_DIV" >/dev/null
upload_pdf habiba@example.com "$AREWA_ID" "$BILAT_ID" "$PDF_DIR/fcdo.pdf" division "$LEGAL_ID" "$INTL_DIV" >/dev/null
upload_pdf habiba@example.com "$AREWA_ID" "$TMPL_ID" "$PDF_DIR/nda.pdf" company "$LEGAL_ID" "" >/dev/null
upload_pdf habiba@example.com "$AREWA_ID" "$TMPL_ID" "$PDF_DIR/consult.pdf" company "$LEGAL_ID" "" >/dev/null
upload_pdf maryam@example.com "$GDP_ID" "$IP_ID" "$PDF_DIR/subaward.pdf" division "$PROG_ID" "$IP_DIV" >/dev/null
green "  PDFs uploaded"

blue "═══ 8. Rich-text minutes via API ═══"
api POST /files/rich-text habiba@example.com "$(jq -n \
  --arg fileName 'Negotiation Minutes — Flour Mills.html' \
  --arg folderId "$PRIV_ID" --arg departmentId "$LEGAL_ID" --arg divisionId "$NG_DIV" \
  --arg html '<div class="dt-richtext-signable" style="position:relative;min-height:100%;"><h1>Negotiation Minutes</h1><p><strong>Parties:</strong> Arewa Contract Services Ltd and Flour Mills of Nigeria Plc</p><p><strong>Venue:</strong> Kano office</p><p>Discussed Q2 delivery schedules. Pending dual legal sign-off.</p></div>' \
  '{fileName:$fileName,htmlContent:$html,scopeLevel:"division",folderId:$folderId,departmentId:$departmentId,divisionId:$divisionId}')" >/dev/null

api POST /files/rich-text maryam@example.com "$(jq -n \
  --arg fileName 'IP Kickoff Notes — Kaduna.html' \
  --arg folderId "$IP_ID" --arg departmentId "$PROG_ID" --arg divisionId "$IP_DIV" \
  --arg html '<div class="dt-richtext-signable" style="position:relative;min-height:100%;"><h1>IP Kickoff Notes — Kaduna</h1><p>Participants: Kabiru Hassan (GDP), Ibrahim Sani (Arewa CS).</p><p>Agreed reporting calendar and signature blocks.</p></div>' \
  '{fileName:$fileName,htmlContent:$html,scopeLevel:"division",folderId:$folderId,departmentId:$departmentId,divisionId:$divisionId}')" >/dev/null
green "  Rich-text docs created"

blue "═══ Done ═══"
green "Admin:     $ADMIN_EMAIL / $PASS"
green "Secretary: habiba@example.com / $PASS  (Arewa)"
green "Secretary: maryam@example.com / $PASS  (GDP)"
green "Open Documents → Contracts Registry to browse the tree."
green "Open a PDF → Request signature → Sign now → click any page spot."
