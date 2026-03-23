const fs = require('fs');
const path = require('path');
const outDir = path.join('C:', 'Users', 'user', 'Desktop', 'MGM');

// Read current HTML (lines 1-824 = CSS + HTML body)
const currentHtml = fs.readFileSync(path.join(outDir, 'mgm_calculator.html'), 'utf-8');
const lines = currentHtml.split('\n');
const htmlPart = lines.slice(0, 824).join('\n'); // up to and not including <script>

// Read full KT data
const ktData = fs.readFileSync(path.join(outDir, 'kt_full_data.js'), 'utf-8');

// Read MGM discount data
const mgmDataRaw = JSON.parse(fs.readFileSync(path.join(outDir, 'mgm_data.json'), 'utf-8'));
const mgmDiscountJs = 'const MGM_DISCOUNT = ' + JSON.stringify(mgmDataRaw.mgm_discount) + ';';
const mgmModelsJs = 'const MGM_MODELS_INFO = ' + JSON.stringify(mgmDataRaw.models) + ';';

// Build new JS section
const jsSection = `<script>
// ============================================================
// KT 공식 데이터 (요금제, 모델, 출고가, 공통지원금)
// ============================================================
${ktData}

// ============================================================
// MGM 고객할인금 데이터 (Excel 기반)
// ============================================================
${mgmDiscountJs}

// MGM 모델 네트워크 정보 (LTE/5G 구분용)
${mgmModelsJs}

// ============================================================
// DOM REFS
// ============================================================
var $openType, $modelSelect, $planSelect, $discountType, $referralBenefit, $planInfo;
var $retailPrice, $subsidy, $subsidyDesc, $finalPhonePrice, $totalInterest;
var $monthlyPhone, $monthlyInterest, $monthlyPlanFee, $planDiscount, $discountDesc;
var $monthlyPlanNet, $grandTotal, $breakdownPhone, $breakdownPlan;
var $mgmDiscountDisplay, $referralHelper;

// ============================================================
// ADMIN: sold-out filter
// ============================================================
function getSoldOutModels() {
  try {
    var data = localStorage.getItem('mgm_soldout');
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

// ============================================================
// INIT SELECTS
// ============================================================
function populateModels() {
  var soldOut = getSoldOutModels();
  var prevVal = $modelSelect.value;
  $modelSelect.innerHTML = '';

  // Show ALL models from KT MODEL_MAP (not just MGM models)
  for (var code in MODEL_MAP) {
    if (soldOut.indexOf(code) !== -1) continue;
    var opt = document.createElement('option');
    opt.value = code;
    opt.textContent = MODEL_MAP[code];
    $modelSelect.appendChild(opt);
  }

  if (prevVal && $modelSelect.querySelector('option[value="' + prevVal + '"]')) {
    $modelSelect.value = prevVal;
  }
  populatePlans();
}

function populatePlans() {
  var openType = $openType.value;
  var modelCode = $modelSelect.value;
  var prevPlan = $planSelect.value;
  $planSelect.innerHTML = '';

  // Show all KT plans from PLAN_DATA
  for (var planName in PLAN_DATA) {
    var opt = document.createElement('option');
    opt.value = planName;
    opt.textContent = planName;
    $planSelect.appendChild(opt);
  }

  if (prevPlan && $planSelect.querySelector('option[value="' + prevPlan + '"]')) {
    $planSelect.value = prevPlan;
  }
  calculate();
}

// ============================================================
// FORMATTING
// ============================================================
function fmt(n) { return n.toLocaleString('ko-KR'); }

function animateValue(el) {
  el.classList.remove('value-updated');
  void el.offsetWidth;
  el.classList.add('value-updated');
}

function updateDisplay(el, newText) {
  if (el.textContent !== newText) {
    el.textContent = newText;
    animateValue(el);
  }
}

// ============================================================
// SUBSIDY LOOKUP (KT 공식 공통지원금)
// ============================================================
function getSubsidy(openType, planName, modelCode) {
  if (!SUBSIDY_DATA[openType]) return 0;
  if (!SUBSIDY_DATA[openType][planName]) return 0;
  return SUBSIDY_DATA[openType][planName][modelCode] || 0;
}

// ============================================================
// MGM 구간 매핑 (월정액 → MGM 할인 티어)
// ============================================================
function getMgmTier(monthlyFee, modelCode) {
  // Check if model is LTE using MGM_MODELS_INFO (from Excel)
  var isLTE = false;
  if (MGM_MODELS_INFO[modelCode] && MGM_MODELS_INFO[modelCode].network === 'LTE') {
    isLTE = true;
  }

  if (isLTE) {
    if (monthlyFee >= 49000) return '데이터ON 프리미엄';
    if (monthlyFee >= 33000) return 'LTE베이직';
    return null;
  } else {
    if (monthlyFee >= 80000) return '베이직';
    if (monthlyFee >= 61000) return '심플30G';
    if (monthlyFee >= 49000) return '슬림10G';
    if (monthlyFee >= 33000) return '슬림4G';
    return null;
  }
}

// ============================================================
// CALCULATION
// ============================================================
var INTEREST_RATE = 0.059;
var INSTALLMENT_MONTHS = 24;

function computeScenario(retailPrice, subsidy, effectiveDiscount, monthlyFee, applyFeeDiscount) {
  var finalPrice = Math.max(0, retailPrice - subsidy - effectiveDiscount);
  var monthlyPayment = 0, totalInterest = 0, monthlyInterest = 0;
  if (finalPrice > 0) {
    var r = INTEREST_RATE / 12;
    var n = INSTALLMENT_MONTHS;
    monthlyPayment = Math.round(finalPrice * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
    totalInterest = monthlyPayment * n - finalPrice;
    monthlyInterest = Math.round(totalInterest / n);
  }
  var monthlyPhone = monthlyPayment > 0 ? monthlyPayment - monthlyInterest : 0;
  var planDiscount = applyFeeDiscount ? Math.round(monthlyFee * 0.25) : 0;
  var monthlyPlanNet = monthlyFee - planDiscount;
  var grandTotal = monthlyPayment + monthlyPlanNet;
  return {
    finalPrice: finalPrice, totalInterest: totalInterest,
    monthlyPhone: monthlyPhone, monthlyInterest: monthlyInterest,
    monthlyPhoneTotal: monthlyPayment, planDiscount: planDiscount,
    monthlyPlanNet: monthlyPlanNet, grandTotal: grandTotal, subsidy: subsidy
  };
}

function calculate() {
  var openType = $openType.value;
  var modelCode = $modelSelect.value;
  var planName = $planSelect.value;
  if (!modelCode || !planName) return;

  var plan = PLAN_DATA[planName] || { fee: 0, category: '' };
  var monthlyFee = plan.fee;
  var retailPrice = PRICE_MAP[modelCode] || 0;

  // MGM 고객할인금 (요금제 구간으로 매핑)
  var mgmTier = getMgmTier(monthlyFee, modelCode);
  var mgmDiscount = 0;
  if (mgmTier && MGM_DISCOUNT[openType] && MGM_DISCOUNT[openType][mgmTier] && MGM_DISCOUNT[openType][mgmTier][modelCode]) {
    mgmDiscount = MGM_DISCOUNT[openType][mgmTier][modelCode];
  }

  // 권유자 혜택금
  var referralBenefit = parseInt($referralBenefit.value) || 0;
  if (referralBenefit < 0) referralBenefit = 0;
  if (referralBenefit > mgmDiscount) {
    referralBenefit = mgmDiscount;
    $referralBenefit.value = mgmDiscount;
  }

  if (parseInt($referralBenefit.value) > mgmDiscount && mgmDiscount > 0) {
    $referralHelper.textContent = '권유자 혜택금은 고객 할인금(' + fmt(mgmDiscount) + '원)을 초과할 수 없습니다.';
    $referralHelper.classList.add('error');
  } else {
    $referralHelper.textContent = '권유자에게 지급할 혜택금 (고객 할인금에서 차감됩니다)';
    $referralHelper.classList.remove('error');
  }

  // 실제 적용 할인 = 고객할인금 - 권유자혜택금
  var effectiveDiscount = mgmDiscount - referralBenefit;

  // Display
  $mgmDiscountDisplay.textContent = fmt(mgmDiscount);

  // 공통지원금 (KT 공식)
  var subsidyAmount = getSubsidy(openType, planName, modelCode);

  // 두 시나리오 계산
  var publicScenario = computeScenario(retailPrice, subsidyAmount, effectiveDiscount, monthlyFee, false);
  var feeScenario = computeScenario(retailPrice, 0, effectiveDiscount, monthlyFee, true);

  var publicWins = publicScenario.grandTotal <= feeScenario.grandTotal;
  var savings = Math.abs(publicScenario.grandTotal - feeScenario.grandTotal);

  var discountChoice = $discountType.value;
  var best = discountChoice === '공시할인' ? publicScenario : feeScenario;

  // Plan info
  $planInfo.textContent = '월정액: ' + fmt(monthlyFee) + '원 | 요금구분: ' + (plan.category || '') + (mgmTier ? ' | MGM구간: ' + mgmTier : '');

  // Subsidy desc
  var subsidy = best.subsidy;
  if (discountChoice === '공시할인') {
    $subsidyDesc.textContent = subsidy > 0
      ? '공시할인 적용 — 공통지원금 ' + fmt(subsidy) + '원'
      : '공시할인 — 해당 조합의 공통지원금 데이터 없음';
  } else {
    $subsidyDesc.textContent = '요금할인 선택 시 공통지원금 미적용';
  }

  if (discountChoice === '요금할인') {
    $discountDesc.textContent = '요금할인 선택 시, 약정에 대한 통신사의 月 할인금액(25%)';
  } else {
    $discountDesc.textContent = '공시할인 선택 시 요금할인 미적용';
  }

  // Detail DOM
  updateDisplay($retailPrice, fmt(retailPrice));
  updateDisplay($subsidy, fmt(subsidy));
  updateDisplay(document.getElementById('corpDiscountDetail'), effectiveDiscount > 0 ? '-' + fmt(effectiveDiscount) : '0');
  updateDisplay($finalPhonePrice, fmt(best.finalPrice));
  updateDisplay($totalInterest, fmt(best.totalInterest));
  updateDisplay($monthlyPhone, fmt(best.monthlyPhone));
  updateDisplay($monthlyInterest, fmt(best.monthlyInterest));
  updateDisplay($monthlyPlanFee, fmt(monthlyFee));
  updateDisplay($planDiscount, best.planDiscount > 0 ? '-' + fmt(best.planDiscount) : '0');
  updateDisplay($monthlyPlanNet, fmt(best.monthlyPlanNet));

  // Summary
  $grandTotal.textContent = fmt(best.grandTotal) + '원';
  animateValue($grandTotal);
  $breakdownPhone.textContent = fmt(best.monthlyPhoneTotal) + '원';
  $breakdownPlan.textContent = fmt(best.monthlyPlanNet) + '원';

  // Comparison cards
  document.getElementById('compPublicSubsidy').textContent = subsidyAmount > 0 ? '-' + fmt(subsidyAmount) : '0';
  document.getElementById('compPublicCorpDiscount').textContent = effectiveDiscount > 0 ? '-' + fmt(effectiveDiscount) : '0';
  document.getElementById('compPublicFinalPrice').textContent = fmt(publicScenario.finalPrice);
  document.getElementById('compPublicMonthly').textContent = fmt(publicScenario.monthlyPhoneTotal);
  document.getElementById('compPublicPlan').textContent = fmt(publicScenario.monthlyPlanNet);
  document.getElementById('compPublicTotal').textContent = fmt(publicScenario.grandTotal) + '원';

  document.getElementById('compFeeSubsidy').textContent = '0 (미적용)';
  document.getElementById('compFeeCorpDiscount').textContent = effectiveDiscount > 0 ? '-' + fmt(effectiveDiscount) : '0';
  document.getElementById('compFeeFinalPrice').textContent = fmt(feeScenario.finalPrice);
  document.getElementById('compFeeMonthly').textContent = fmt(feeScenario.monthlyPhoneTotal);
  document.getElementById('compFeeDiscount').textContent = feeScenario.planDiscount > 0 ? '-' + fmt(feeScenario.planDiscount) : '0';
  document.getElementById('compFeePlan').textContent = fmt(feeScenario.monthlyPlanNet);
  document.getElementById('compFeeTotal').textContent = fmt(feeScenario.grandTotal) + '원';

  // Winner
  var cardPublic = document.getElementById('compCardPublic');
  var cardFee = document.getElementById('compCardFee');
  var badgePublic = document.getElementById('compPublicBadge');
  var badgeFee = document.getElementById('compFeeBadge');
  cardPublic.classList.toggle('winner', publicWins);
  cardFee.classList.toggle('winner', !publicWins);
  if (savings > 0) {
    if (publicWins) {
      badgePublic.textContent = fmt(savings) + '원 절약';
      badgePublic.classList.add('show');
      badgeFee.classList.remove('show');
    } else {
      badgeFee.textContent = fmt(savings) + '원 절약';
      badgeFee.classList.add('show');
      badgePublic.classList.remove('show');
    }
  } else {
    badgePublic.classList.remove('show');
    badgeFee.classList.remove('show');
  }
}

// ============================================================
// INIT
// ============================================================
function init() {
  $openType = document.getElementById('openType');
  $modelSelect = document.getElementById('modelSelect');
  $planSelect = document.getElementById('planSelect');
  $discountType = document.getElementById('discountType');
  $referralBenefit = document.getElementById('referralBenefit');
  $planInfo = document.getElementById('planInfo');
  $retailPrice = document.getElementById('retailPrice');
  $subsidy = document.getElementById('subsidy');
  $subsidyDesc = document.getElementById('subsidyDesc');
  $finalPhonePrice = document.getElementById('finalPhonePrice');
  $totalInterest = document.getElementById('totalInterest');
  $monthlyPhone = document.getElementById('monthlyPhone');
  $monthlyInterest = document.getElementById('monthlyInterest');
  $monthlyPlanFee = document.getElementById('monthlyPlanFee');
  $planDiscount = document.getElementById('planDiscount');
  $discountDesc = document.getElementById('discountDesc');
  $monthlyPlanNet = document.getElementById('monthlyPlanNet');
  $grandTotal = document.getElementById('grandTotal');
  $breakdownPhone = document.getElementById('breakdownPhone');
  $breakdownPlan = document.getElementById('breakdownPlan');
  $mgmDiscountDisplay = document.getElementById('mgmDiscountDisplay');
  $referralHelper = document.getElementById('referralHelper');

  populateModels();

  $openType.addEventListener('change', populateModels);
  $modelSelect.addEventListener('change', populatePlans);
  $planSelect.addEventListener('change', calculate);
  $discountType.addEventListener('change', calculate);
  $referralBenefit.addEventListener('input', calculate);
}

document.addEventListener('DOMContentLoaded', init);
</script>

</body>
</html>`;

// Combine
const finalHtml = htmlPart + '\n' + jsSection;
fs.writeFileSync(path.join(outDir, 'mgm_calculator.html'), finalHtml, 'utf-8');
console.log('Done! File size:', finalHtml.length, 'bytes');
