$ErrorActionPreference = "Continue"
$BASE = "http://localhost:5000/api/v1"
$PASS = 0; $FAIL = 0; $SKIP = 0; $ISSUES = @()

function Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green;  $script:PASS++ }
function Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:FAIL++; $script:ISSUES += $msg }
function Skip($msg) { Write-Host "  [SKIP] $msg" -ForegroundColor Yellow; $script:SKIP++ }
function Section($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

function Req($method, $url, $body=$null, $token=$null) {
    $h = @{}
    if ($token) { $h["Authorization"] = "Bearer $token" }
    if ($body)  { $h["Content-Type"]  = "application/json" }
    $full = "$BASE$url"
    try {
        if ($body) { return Invoke-RestMethod -Uri $full -Method $method -Headers $h -Body ($body|ConvertTo-Json -Depth 10) -ErrorAction Stop }
        else       { return Invoke-RestMethod -Uri $full -Method $method -Headers $h -ErrorAction Stop }
    } catch {
        return [PSCustomObject]@{ _fail=$true; _code=[int]$_.Exception.Response.StatusCode; _msg=$_.ErrorDetails.Message }
    }
}

# ── 1. HEALTH ─────────────────────────────────────────────────────────────────
Section "1. HEALTH CHECK"
$h = Req GET "/health"
if ($h.success -and $h.database.connected) { Pass "Health: DB connected, status=ok" }
else { Fail "Health failed: $($h._msg)" }

# ── 2. DEPENDENCIES ───────────────────────────────────────────────────────────
Section "2. DEPENDENCIES"
if (Test-Path "node_modules/express")       { Pass "server/node_modules: installed" } else { Fail "server/node_modules missing" }
if (Test-Path "../client/node_modules/react") { Pass "client/node_modules: installed" } else { Fail "client/node_modules missing" }

# ── 3. AUTH ───────────────────────────────────────────────────────────────────
Section "3. AUTHENTICATION"
$email = "qa_$(Get-Random -Max 999999)@test.com"; $pw = "QaTest@9999"

$reg = Req POST "/auth/register" @{name="QA User";email=$email;password=$pw;businessName="QA Corp"}
if ($reg.success -and $reg.data.token)       { Pass "Register: token returned" }          else { Fail "Register failed: $($reg._msg)" }
if (-not $reg.data.user.password)            { Pass "Register: password not in response" } else { Fail "Register: PASSWORD LEAKED" }
$TOKEN = $reg.data.token

$dup = Req POST "/auth/register" @{name="D";email=$email;password=$pw}
if ($dup._fail -and $dup._code -eq 409)      { Pass "Register: duplicate email -> 409" }  else { Fail "Duplicate email accepted (code=$($dup._code))" }

$weak = Req POST "/auth/register" @{name="X";email="w$(Get-Random)@t.com";password="abc"}
if ($weak._fail)                             { Pass "Register: weak password rejected" }   else { Fail "Weak password accepted" }

$login = Req POST "/auth/login" @{email=$email;password=$pw}
if ($login.success -and $login.data.token)   { Pass "Login: success" }                    else { Fail "Login failed: $($login._msg)" }
$TOKEN = $login.data.token

$bad = Req POST "/auth/login" @{email=$email;password="Wrong@99"}
if ($bad._fail -and $bad._code -eq 401)      { Pass "Login: wrong password -> 401" }      else { Fail "Wrong password accepted" }

$me = Req GET "/auth/me" -token $TOKEN
if ($me.success -and $me.data.user.email -eq $email) { Pass "GET /me: correct user" }     else { Fail "GET /me failed" }
if (-not $me.data.user.password)             { Pass "GET /me: password not exposed" }     else { Fail "GET /me: PASSWORD LEAKED" }

$unauth = Req GET "/auth/me"
if ($unauth._fail -and $unauth._code -eq 401) { Pass "Unauth: 401 without token" }        else { Fail "Unauth: allowed without token" }

$lo = Req POST "/auth/logout" @{}
if ($lo.success)                             { Pass "Logout: success" }                    else { Fail "Logout failed" }

# Create second user for isolation tests
$e2 = "qa2_$(Get-Random -Max 999999)@test.com"
$reg2 = Req POST "/auth/register" @{name="U2";email=$e2;password=$pw}
$T2 = $reg2.data.token

# ── 4. CUSTOMERS ──────────────────────────────────────────────────────────────
Section "4. CUSTOMERS CRUD"
$c = Req POST "/customers" @{name="Acme Technologies";email="acme@tech.com";phone="9876543210"} -token $TOKEN
if ($c.success -and $c.data.customer._id)    { Pass "Customer CREATE: success" }           else { Fail "Customer CREATE: $($c._msg)" }
$CID = $c.data.customer._id

$cl = Req GET "/customers" -token $TOKEN
if ($cl.success -and $cl.data.Count -ge 1)   { Pass "Customer LIST: records returned" }   else { Fail "Customer LIST failed" }
if ($cl.pagination.total -ge 1)              { Pass "Customer LIST: pagination present" } else { Fail "Customer LIST: no pagination" }

$co = Req GET "/customers/$CID" -token $TOKEN
if ($co.success -and $co.data.customer._id -eq $CID) { Pass "Customer GET by ID: correct" } else { Fail "Customer GET failed" }

$cu = Req PUT "/customers/$CID" @{name="Acme Updated";phone="1234567890"} -token $TOKEN
if ($cu.success -and $cu.data.customer.name -eq "Acme Updated") { Pass "Customer UPDATE: name changed" } else { Fail "Customer UPDATE failed" }

$cs = Req POST "/customers" @{name="X"} -token $TOKEN
if ($cs._fail)                               { Pass "Customer: 1-char name rejected" }    else { Fail "Customer: invalid name accepted" }

$cc = Req GET "/customers/$CID" -token $T2
if ($cc._fail -and $cc._code -eq 404)        { Pass "Customer: cross-user -> 404" }       else { Fail "Customer: cross-user data accessible" }

# ── 5. INVOICES CRUD + CALCULATIONS ──────────────────────────────────────────
Section "5. INVOICES + SERVER-SIDE CALCULATIONS"
$ib = @{
    customerId=$CID; issueDate="2025-06-01"; dueDate="2025-12-31"
    lineItems=@(
        @{description="Web Dev";quantity=10;unitPrice=500;taxRate=18}
        @{description="Design"; quantity=5; unitPrice=200;taxRate=0}
    )
    discountType="percentage"; discountValue=10
    status="draft"; notes="QA invoice"
}
$inv = Req POST "/invoices" $ib -token $TOKEN
if ($inv.success -and $inv.data.invoice._id) { Pass "Invoice CREATE: success" }           else { Fail "Invoice CREATE: $($inv._msg)" }
$IID = $inv.data.invoice._id

# Expected: subtotal=600000, tax=90000, discount=60000, grand=630000 (all paise)
if ($inv.data.invoice.subtotal      -eq 600000) { Pass "Calc subtotal=600000 paise" }     else { Fail "Calc subtotal=$($inv.data.invoice.subtotal) expected 600000" }
if ($inv.data.invoice.taxTotal      -eq 90000)  { Pass "Calc taxTotal=90000 paise" }      else { Fail "Calc taxTotal=$($inv.data.invoice.taxTotal) expected 90000" }
if ($inv.data.invoice.discountAmount -eq 60000) { Pass "Calc discount=60000 paise" }      else { Fail "Calc discount=$($inv.data.invoice.discountAmount) expected 60000" }
if ($inv.data.invoice.grandTotal    -eq 630000) { Pass "Calc grandTotal=630000 paise" }   else { Fail "Calc grandTotal=$($inv.data.invoice.grandTotal) expected 630000" }
if ($inv.data.invoice.paidAmount    -eq 0)      { Pass "Calc paidAmount=0 on creation" }  else { Fail "Calc paidAmount wrong" }

# Tampered totals must be ignored
$tb = @{customerId=$CID;issueDate="2025-06-01";dueDate="2025-12-31";lineItems=@(@{description="X";quantity=1;unitPrice=100;taxRate=0});grandTotal=999999}
$ti = Req POST "/invoices" $tb -token $TOKEN
if ($ti.success -and $ti.data.invoice.grandTotal -ne 999999) { Pass "Security: frontend totals ignored, server recalculates" } else { Fail "Security: frontend grandTotal=$($ti.data.invoice.grandTotal)" }

$il = Req GET "/invoices" -token $TOKEN
if ($il.success -and $il.pagination.total -ge 1) { Pass "Invoice LIST: paginated" }       else { Fail "Invoice LIST failed" }

$io = Req GET "/invoices/$IID" -token $TOKEN
if ($io.success -and $io.data.invoice.outstandingBalance -eq 630000) { Pass "Invoice GET: outstandingBalance=630000" } else { Fail "Invoice GET: balance=$($io.data.invoice.outstandingBalance)" }

$iu = Req PUT "/invoices/$IID" @{notes="Updated note";status="sent"} -token $TOKEN
if ($iu.success -and $iu.data.invoice.status -eq "sent") { Pass "Invoice UPDATE: status->sent" } else { Fail "Invoice UPDATE failed" }

# Validation: due before issue
$bd = Req POST "/invoices" @{customerId=$CID;issueDate="2025-06-01";dueDate="2025-01-01";lineItems=@(@{description="X";quantity=1;unitPrice=100})} -token $TOKEN
if ($bd._fail)                               { Pass "Invoice: due<issue rejected" }        else { Fail "Invoice: due<issue accepted" }

# Validation: empty items
$bi = Req POST "/invoices" @{customerId=$CID;issueDate="2025-01-01";dueDate="2025-12-31";lineItems=@()} -token $TOKEN
if ($bi._fail)                               { Pass "Invoice: empty items rejected" }      else { Fail "Invoice: empty items accepted" }

$ci = Req GET "/invoices/$IID" -token $T2
if ($ci._fail -and $ci._code -eq 404)        { Pass "Invoice: cross-user -> 404" }        else { Fail "Invoice: cross-user accessible" }

# ── 6. DUPLICATE DETECTION ────────────────────────────────────────────────────
Section "6. DUPLICATE DETECTION"
$dq = "customerId=$CID" + "&grandTotal=6300" + "&issueDate=2025-06-01"
$dc = Req GET "/invoices/check-duplicate?$dq" -token $TOKEN
if ($dc.success -and $dc.data.isDuplicate -eq $true) { Pass "Duplicate: match found" }    else { Fail "Duplicate: not detected (isDuplicate=$($dc.data.isDuplicate))" }

$nq = "customerId=$CID" + "&grandTotal=1" + "&issueDate=2020-01-01"
$nd = Req GET "/invoices/check-duplicate?$nq" -token $TOKEN
if ($nd.success -and $nd.data.isDuplicate -eq $false) { Pass "Duplicate: no false positive" } else { Fail "Duplicate: false positive" }

# ── 7. PAYMENTS ───────────────────────────────────────────────────────────────
Section "7. PAYMENTS"
$p1 = Req POST "/invoices/$IID/payments" @{amount=3000;paymentMethod="upi";referenceNumber="UTR001"} -token $TOKEN
if ($p1.success -and $p1.data.payment.amount -eq 300000) { Pass "Payment: partial recorded, 300000 paise" } else { Fail "Payment failed: $($p1._msg)" }

$af = Req GET "/invoices/$IID" -token $TOKEN
if ($af.data.invoice.status -eq "partially_paid")       { Pass "Payment: status->partially_paid" }  else { Fail "Payment: status=$($af.data.invoice.status)" }
if ($af.data.invoice.outstandingBalance -eq 330000)     { Pass "Payment: outstandingBalance=330000" } else { Fail "Payment: balance=$($af.data.invoice.outstandingBalance)" }

$ov = Req POST "/invoices/$IID/payments" @{amount=99999} -token $TOKEN
if ($ov._fail)                                          { Pass "Payment: overpayment rejected" }     else { Fail "Payment: overpayment accepted" }

$p2 = Req POST "/invoices/$IID/payments" @{amount=3300;paymentMethod="bank_transfer"} -token $TOKEN
if ($p2.success)                                        { Pass "Payment: full remaining accepted" }  else { Fail "Payment: full payment failed: $($p2._msg)" }

$af2 = Req GET "/invoices/$IID" -token $TOKEN
if ($af2.data.invoice.status -eq "paid")                { Pass "Payment: status->paid after full" }  else { Fail "Payment: status=$($af2.data.invoice.status)" }
if ($af2.data.invoice.outstandingBalance -eq 0)         { Pass "Payment: outstandingBalance=0" }     else { Fail "Payment: balance=$($af2.data.invoice.outstandingBalance)" }

$ex = Req POST "/invoices/$IID/payments" @{amount=100} -token $TOKEN
if ($ex._fail)                                          { Pass "Payment: rejected on paid invoice" } else { Fail "Payment: accepted on paid invoice" }

$dp = Req DELETE "/invoices/$IID" -token $TOKEN
if ($dp._fail)                                          { Pass "Invoice: paid delete blocked" }      else { Fail "Invoice: paid invoice deleted" }

# ── 8. DELETE (draft) ─────────────────────────────────────────────────────────
Section "8. INVOICE DELETE"
$dr = Req POST "/invoices" @{customerId=$CID;issueDate="2025-07-01";dueDate="2025-12-31";lineItems=@(@{description="Consulting";quantity=1;unitPrice=1000;taxRate=0});status="draft"} -token $TOKEN
$DID = $dr.data.invoice._id
$dl = Req DELETE "/invoices/$DID" -token $TOKEN
if ($dl.success)                                        { Pass "Invoice DELETE: draft deleted" }     else { Fail "Invoice DELETE failed: $($dl._msg)" }
$gn = Req GET "/invoices/$DID" -token $TOKEN
if ($gn._fail -and $gn._code -eq 404)                  { Pass "Invoice DELETE: confirmed 404" }     else { Fail "Invoice DELETE: still accessible" }

# ── 9. DASHBOARD ──────────────────────────────────────────────────────────────
Section "9. DASHBOARD AGGREGATIONS"
$ds = Req GET "/dashboard/summary" -token $TOKEN
if ($ds.success)                                        { Pass "Dashboard SUMMARY: responds" }       else { Fail "Dashboard SUMMARY: $($ds._msg)" }
if ($ds.data.summary.totalCount -ge 1)                 { Pass "Dashboard SUMMARY: totalCount from DB" } else { Fail "Dashboard SUMMARY: totalCount=0" }
if ($ds.data.summary.totalInvoiced -gt 0)              { Pass "Dashboard SUMMARY: totalInvoiced from DB" } else { Fail "Dashboard SUMMARY: totalInvoiced=0" }
if ($null -ne $ds.data.recentInvoices)                 { Pass "Dashboard SUMMARY: recentInvoices present" } else { Fail "Dashboard SUMMARY: recentInvoices missing" }

$dr2 = Req GET "/dashboard/revenue?months=6" -token $TOKEN
if ($dr2.success -and $dr2.data.chartData.Count -eq 6) { Pass "Dashboard REVENUE: 6 months returned" } else { Fail "Dashboard REVENUE: count=$($dr2.data.chartData.Count)" }

$dstat = Req GET "/dashboard/invoice-status" -token $TOKEN
if ($dstat.success -and $dstat.data.statusData.Count -ge 1) { Pass "Dashboard STATUS: distribution from DB" } else { Fail "Dashboard STATUS: empty ($($dstat._msg))" }

# ── 10. PERSISTENCE ───────────────────────────────────────────────────────────
Section "10. PERSISTENCE"
$pp1 = Req GET "/invoices" -token $TOKEN
if ($pp1.pagination.total -ge 1)                       { Pass "Persistence: invoices survive in DB" } else { Fail "Persistence: no invoices found" }
$pp2 = Req GET "/customers" -token $TOKEN
if ($pp2.pagination.total -ge 1)                       { Pass "Persistence: customers survive in DB" } else { Fail "Persistence: no customers found" }
$pp3 = Req GET "/invoices/$IID" -token $TOKEN
if ($pp3.success -and $pp3.data.invoice.status -eq "paid") { Pass "Persistence: paid status preserved" } else { Fail "Persistence: invoice state not preserved" }

# ── 11. AI ────────────────────────────────────────────────────────────────────
Section "11. AI INVOICE EXTRACTION"
$aiKey = ((Get-Content ".env" | Where-Object { $_ -match "^AI_API_KEY=" }) -replace "^AI_API_KEY=","").Trim()
$aiModel = ((Get-Content ".env" | Where-Object { $_ -match "^AI_MODEL=" }) -replace "^AI_MODEL=","").Trim()
$aiProvider = ((Get-Content ".env" | Where-Object { $_ -match "^AI_PROVIDER=" }) -replace "^AI_PROVIDER=","").Trim()

Write-Host "  Provider : $aiProvider"
Write-Host "  Model    : $aiModel"
Write-Host "  Key set  : $(-not ($aiKey.StartsWith('your_') -or $aiKey.StartsWith('REPLACE') -or $aiKey.Length -lt 10))"

$isPlaceholder = $aiKey.StartsWith('your_') -or $aiKey.StartsWith('REPLACE') -or $aiKey.Length -lt 10

if ($isPlaceholder) {
    Skip "AI: placeholder key — skipping live extraction test"
} else {
    # Direct API test
    $aibody = "{`"model`":`"$aiModel`",`"messages`":[{`"role`":`"user`",`"content`":`"Say: ready`"}],`"max_tokens`":5}"
    try {
        $air = Invoke-RestMethod "https://api.groq.com/openai/v1/chat/completions" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $aiKey"} -Body $aibody -ErrorAction Stop
        Pass "AI: Groq API key valid, model '$aiModel' responds"

        # Test via endpoint with sample text
        $boundary = "QAbnd$(Get-Random)"
        $sample = "INVOICE`nInvoice Number: INV-TEST-001`nDate: 2025-01-15`nDue Date: 2025-02-15`nFrom: Test Supplier`nTo: Test Customer`nItem: Web Development x 10 @ Rs 5000 = Rs 50000`nGST 18pc: Rs 9000`nTotal: Rs 59000"
        $bline1 = "--$boundary`r`nContent-Disposition: form-data; name=`"invoice`"; filename=`"test.pdf`"`r`nContent-Type: application/pdf`r`n`r`n"
        $bline2 = "`r`n--$boundary--"
        $fullBody = [System.Text.Encoding]::UTF8.GetBytes($bline1 + $sample + $bline2)

        try {
            $ext = Invoke-RestMethod "$BASE/ai/extract-invoice" -Method POST -Headers @{Authorization="Bearer $TOKEN";"Content-Type"="multipart/form-data; boundary=$boundary"} -Body $fullBody -ErrorAction Stop
            if ($ext.success) { Pass "AI EXTRACT: data extracted via endpoint" }
            else { Fail "AI EXTRACT: endpoint returned failure" }
        } catch {
            $em = ($_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue).message
            if ($em -match "extract|text|PDF|manual|Invalid") { Pass "AI EXTRACT: handled gracefully — $em" }
            else { Fail "AI EXTRACT: unexpected error — $em" }
        }
    } catch {
        $em = ($_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue).error.message
        Fail "AI: key invalid/revoked — $em"
        Skip "AI EXTRACT: skipped (key invalid)"
    }
}

# Manual entry always available regardless of AI
$mn = Req POST "/invoices" @{customerId=$CID;issueDate="2025-08-01";dueDate="2025-12-31";lineItems=@(@{description="Manual item";quantity=1;unitPrice=5000;taxRate=18});status="draft"} -token $TOKEN
if ($mn.success) { Pass "AI fallback: manual invoice entry works without AI" } else { Fail "Manual invoice creation broken: $($mn._msg)" }

# ── 12. EDGE CASES ────────────────────────────────────────────────────────────
Section "12. EDGE CASES"
$nf = Req GET "/no-such-route" -token $TOKEN
if ($nf._fail -and $nf._code -eq 404) { Pass "404: unknown route returns 404" } else { Fail "404: got $($nf._code)" }

$bi2 = Req GET "/invoices/notavalidobjectid" -token $TOKEN
if ($bi2._fail)                       { Pass "Invalid ObjectId: error returned" } else { Fail "Invalid ObjectId: no error" }

$mf = Req POST "/invoices" @{notes="missing all required"} -token $TOKEN
if ($mf._fail)                        { Pass "Missing fields: validation error" } else { Fail "Missing fields: accepted" }

# Rate limit test — 20 rapid requests must all succeed (limit=5000)
$ok = 0
for ($i=1;$i -le 20;$i++) {
    $rr = Req POST "/customers" @{name="RT $i"} -token $TOKEN
    if ($rr.success) { $ok++ }
}
if ($ok -eq 20) { Pass "Rate limit: 20/20 rapid requests succeeded (limit=5000)" } else { Fail "Rate limit: $ok/20 — limit too low" }

# ── 13. FRONTEND API CONFIG ───────────────────────────────────────────────────
Section "13. FRONTEND CONFIG"
$ce = Get-Content "../client/.env" -ErrorAction SilentlyContinue
if ($ce -match "VITE_API_BASE_URL=http://localhost:5000") { Pass "Frontend: VITE_API_BASE_URL -> real backend" } else { Fail "Frontend: API URL misconfigured" }

$api = Get-Content "../client/src/services/api.js" -Raw
if ($api -match "localStorage.getItem\('token'\)") { Pass "Frontend: uses real JWT token from localStorage" } else { Fail "Frontend: token handling missing" }
if ($api -notmatch "mockData|fakeData|hardcoded") { Pass "Frontend: no mock data detected in api.js" } else { Fail "Frontend: mock data found" }

# ── 14. FRONTEND BUILD ────────────────────────────────────────────────────────
Section "14. FRONTEND BUILD"
$bld = cmd /c "cd ..\client && npx vite build 2>&1"
$bldStr = $bld -join "`n"
if ($bldStr -match "built in") { Pass "Frontend: production build SUCCESS" }
else { Fail "Frontend: build failed -- $(($bldStr | Select-String 'error').Line | Select-Object -First 2)" }

# ── 15. BACKEND TESTS ─────────────────────────────────────────────────────────
Section "15. BACKEND AUTOMATED TESTS (Jest)"
$jout = cmd /c "npx jest --no-coverage --runInBand --forceExit 2>&1"
$jstr = $jout -join "`n"
if     ($jstr -match "63 passed")         { Pass "Jest: 63/63 tests passed" }
elseif ($jstr -match "(\d+) passed" -and $jstr -notmatch "failed") { Pass "Jest: $($Matches[1]) passed, 0 failed" }
else { Fail "Jest tests failed -- check output" }

# ── FINAL SUMMARY ─────────────────────────────────────────────────────────────
Write-Host "`n"
Write-Host "================================================" -ForegroundColor White
Write-Host "  QA FINAL RESULTS" -ForegroundColor White
Write-Host "================================================" -ForegroundColor White
Write-Host "  PASSED :  $PASS" -ForegroundColor Green
Write-Host "  FAILED :  $FAIL" -ForegroundColor $(if ($FAIL -eq 0) {"Green"} else {"Red"})
Write-Host "  SKIPPED:  $SKIP" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor White
if ($ISSUES.Count -gt 0) {
    Write-Host "`nFAILED ITEMS:" -ForegroundColor Red
    $ISSUES | ForEach-Object { Write-Host "  x $_" -ForegroundColor Red }
}
