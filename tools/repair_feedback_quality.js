const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

function stripOptionPrefix(optionText) {
  return String(optionText || '')
    .replace(/^\s*(?:\(?\s*[A-Fa-f1-6]\s*\)?\s*[.).:\-]?)\s+/, '')
    .trim();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9$% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanFeedbackText(value) {
  return String(value || '')
    .replace(/^incorrect\.\s*/i, '')
    .replace(/^correct\.\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSentence(value) {
  const cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.]+$/, '');

  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) + '.';
}

function getKeywordTokens(value) {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'by', 'can', 'do', 'does',
    'for', 'from', 'has', 'have', 'if', 'in', 'into', 'is', 'it', 'its', 'not', 'of',
    'on', 'or', 'so', 'than', 'that', 'the', 'their', 'there', 'they', 'this', 'to',
    'was', 'were', 'what', 'when', 'which', 'who', 'will', 'with', 'would', 'you',
    'your'
  ]);

  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function getKeywordOverlapScore(text, reference) {
  const textTokens = new Set(getKeywordTokens(text));
  const refTokens = new Set(getKeywordTokens(reference));

  if (!textTokens.size || !refTokens.size) return 0;

  let matchCount = 0;
  textTokens.forEach((token) => {
    if (refTokens.has(token)) {
      matchCount += 1;
    }
  });

  return matchCount / Math.min(textTokens.size, refTokens.size);
}

function getQuestionPlainText(question) {
  return String(question?.question || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQuestionFocusText(question) {
  const plainQuestion = getQuestionPlainText(question);
  const parts = plainQuestion.split(/(?<=[.?!])\s+/).filter(Boolean);
  const target = [...parts].reverse().find((line) =>
    /\?$/.test(line) || /(which|what|how much|who|best|correct|most likely|following)/i.test(line)
  ) || parts[parts.length - 1] || 'Determine the best answer based on the scenario facts';

  return toSentence(target);
}

function inferQuestionRule(question) {
  const q = getQuestionPlainText(question).toLowerCase();

  if (/beneficiar|contingent|estate|life insured|policyholder/.test(q)) {
    return 'Use beneficiary-order rules: proceeds go to the named beneficiary first, and a contingent beneficiary applies only if the primary beneficiary predeceases the life insured.';
  }

  if (/capital gain|acb|gift|deemed disposition|non-registered/.test(q)) {
    return 'Apply capital-gains tax rules, including deemed disposition and adjusted cost base treatment where relevant.';
  }

  if (/rrsp|rrif|lira|spousal rrsp|pension adjustment/.test(q)) {
    return 'Apply registered-plan contribution and withdrawal rules, including attribution and taxation at withdrawal where applicable.';
  }

  if (/annuit|annuity|term certain|life annuity/.test(q)) {
    return 'Apply annuity contract rules on payment guarantees, beneficiary rights, and taxation of annuity income.';
  }

  if (/segregated fund|guarantee|reset|maturity|death benefit/.test(q)) {
    return 'Apply segregated-fund guarantee rules, including resets, maturity and death guarantees, and beneficiary treatment.';
  }

  if (/mortality|probability of death|life expectancy|life table/.test(q)) {
    return 'Apply mortality and life-table concepts to distinguish probability of death from life expectancy.';
  }

  if (/disabil|critical illness|long-term care|accident|sickness|elimination period|benefit period|offset/.test(q)) {
    return 'Apply the accident and sickness policy rule being tested, then check whether the trigger, waiting period, and benefit conditions are actually satisfied.';
  }

  if (/grace period|reinstatement|incontestable|suicide clause|beneficiary|policy loan|non-forfeiture|free-look|group plan|waiting period/.test(q)) {
    return 'Match the option to the policy provision or definition being tested, and reject choices that describe a different contract feature.';
  }

  return 'Apply the governing LLQP product, contract, and tax rule to the exact facts in the scenario.';
}

function getConceptLabel(question, optionText = '', correctText = '') {
  const questionText = getQuestionPlainText(question);
  const combined = `${questionText} ${optionText} ${correctText}`.toLowerCase();

  if (
    /which statement|what statement|how would|what action|what happens|all of these|each of the following|which of the following/.test(combined) ||
    /^(if|when|normally|the|a|an)\b/i.test(optionText) ||
    /^(if|when|normally|the|a|an)\b/i.test(correctText)
  ) {
    return 'statement';
  }

  if (/beneficiar/.test(combined)) {
    return 'beneficiary designation';
  }

  if (/rider/.test(combined)) {
    return 'rider';
  }

  if (/provision|clause|grace period|reinstatement|free-look|non-forfeiture/.test(combined)) {
    return 'policy provision';
  }

  if (/annuit/.test(combined)) {
    return 'annuity type';
  }

  if (/group/.test(combined) && /contributory|employer|employee/.test(combined)) {
    return 'group plan feature';
  }

  if (/receipt|policy summary|certificate/.test(combined)) {
    return 'document';
  }

  if (/application|sign|initial/.test(combined)) {
    return 'application requirement';
  }

  if (/premium/.test(combined) && /mode|frequency|pay/.test(combined)) {
    return 'premium-payment feature';
  }

  if (/tax|rrsp|rrif|acb|capital gain|registered/.test(combined)) {
    return 'tax treatment';
  }

  if (/benefit|coverage|payable|claim|elimination period/.test(combined)) {
    return 'coverage condition';
  }

  return 'answer';
}

function getCorrectConceptReason(question, correctText) {
  const q = getQuestionPlainText(question).toLowerCase();
  const correct = String(correctText || '').toLowerCase();

  if (/contingent beneficiary/.test(q)) {
    return `The correct answer is "${correctText}" because a contingent beneficiary is paid only if the primary beneficiary dies before the insured.`;
  }

  if (/beneficiar/.test(q) && /irrevocable/.test(correct)) {
    return `The correct idea here is "${correctText}": only an irrevocable beneficiary must consent to a change.`;
  }

  if (/beneficiar/.test(q) && /revocable/.test(correct)) {
    return `The correct idea here is "${correctText}": a revocable beneficiary can be changed by the policyowner without the beneficiary's consent.`;
  }

  if ((/beneficiar/.test(q) || /beneficiar/.test(correct)) && /contingent/.test(correct)) {
    return `The correct answer is "${correctText}" because a contingent beneficiary is paid only if the primary beneficiary dies before the insured.`;
  }

  if ((/beneficiar/.test(q) || /beneficiar/.test(correct)) && /primary/.test(correct)) {
    return `The correct answer is "${correctText}" because the primary beneficiary is first in line to receive the proceeds.`;
  }

  if (/minor beneficiar/.test(`${q} ${correct}`)) {
    return `The correct answer is "${correctText}" because a minor usually cannot give a valid discharge, so payment is commonly made to a trustee or guardian until the child reaches majority.`;
  }

  if (/change (?:of )?beneficiary|change a revocable beneficiary|change the beneficiary/.test(q) && /\banytime\b/.test(correct)) {
    return `The correct answer is "${correctText}" because a revocable beneficiary can be changed by the policyowner at any time.`;
  }

  if (/change (?:of )?beneficiary/.test(q) && /policyowner/.test(correct)) {
    return `The correct answer is "${correctText}" because the policyowner controls beneficiary changes unless the designation is irrevocable.`;
  }

  if (/noncontributory/.test(`${q} ${correct}`)) {
    return `The correct answer is "${correctText}" because a noncontributory plan is paid entirely by the employer.`;
  }

  if (/contributory/.test(`${q} ${correct}`)) {
    return `The correct answer is "${correctText}" because a contributory plan requires employees to share in the premium cost.`;
  }

  if (/grace period/.test(q)) {
    return `The correct answer is "${correctText}" because the grace period is the extra time to pay an overdue premium while coverage stays in force.`;
  }

  if (/reinstat/.test(q)) {
    return `The correct answer is "${correctText}" because reinstatement is the provision that can restore a lapsed policy once the insurer's conditions are met.`;
  }

  if (/free-look/.test(q)) {
    return `The correct answer is "${correctText}" because the free-look period begins when the policy is delivered.`;
  }

  if ((/waiver of premium/.test(q) || /totally disabled/.test(q)) && /waiver|premium|rider/.test(correct)) {
    return `The correct answer is "${correctText}" because this feature keeps the policy in force when the insured qualifies for a disability waiver.`;
  }

  if (/application/.test(q) && /sign/.test(q)) {
    return `The correct answer is "${correctText}" because this question is testing whose signature is or is not required on the application.`;
  }

  if (/application/.test(q) && /\binitials\b/.test(q)) {
    return `The correct answer is "${correctText}" because this question is testing whose initials are required for application changes.`;
  }

  if (/goes into effect|before .* policy .* effect|before .* goes into effect/.test(q)) {
    return `The correct answer is "${correctText}" because that item is not required before the policy takes effect.`;
  }

  if (/what action should|producer then take|producer take/.test(q)) {
    return `The correct answer is "${correctText}" because that action follows the underwriting or delivery rule being tested in this scenario.`;
  }

  if (/which statement|which of the following|what is the underlying concept/.test(q)) {
    return `The correct answer is "${correctText}" because that statement is the one that matches the rule being tested.`;
  }

  if (/what item is given|what is issued/.test(q)) {
    return `The correct answer is "${correctText}" because that is the document the applicant or employee receives in this situation.`;
  }

  if (/what type|which type|what kind|which provision|what provision|what policy feature|what policy provision/.test(q)) {
    return `The correct answer is "${correctText}" because that is the contract feature that matches the fact pattern.`;
  }

  if (correctText) {
    return `The better answer here is "${correctText}".`;
  }

  return '';
}

function getSelectedMismatchReason(question, optionText, correctText) {
  const q = getQuestionPlainText(question).toLowerCase();
  const selected = String(optionText || '').toLowerCase();
  const correct = String(correctText || '').toLowerCase();

  if ((/\bexcept\b|\bnot\b/.test(q)) && optionText) {
    return `"${optionText}" is not the exception here. It is one of the items that is normally true or required.`;
  }

  if (/beneficiar/.test(q) && /(revocable|irrevocable)/.test(`${selected} ${correct}`)) {
    if (/(primary|contingent|tertiary)/.test(selected)) {
      return `"${optionText}" describes beneficiary order, not whether the designation can be changed.`;
    }

    if (/revocable/.test(selected) && /irrevocable/.test(correct)) {
      return `"${optionText}" is the opposite of what the facts show. A beneficiary who must consent to a change is irrevocable.`;
    }

    if (/irrevocable/.test(selected) && /revocable/.test(correct)) {
      return `"${optionText}" would require the beneficiary's consent, but the facts say the policyowner can change the designation freely.`;
    }
  }

  if (/change a revocable beneficiary|change the beneficiary|change of beneficiary/.test(q)) {
    if (/consent/.test(selected)) {
      return 'This option incorrectly adds a consent requirement.';
    }

    if (/\bnever\b/.test(selected)) {
      return 'This option is too restrictive for the rule being tested.';
    }

    if (/\bonly\b/.test(selected)) {
      return 'This option adds a condition that the rule does not require.';
    }
  }

  if (/noncontributory/.test(`${q} ${correct}`) && /(shared|both employer and employee|employee)/.test(selected)) {
    return 'This mixes in employee contributions, which is the opposite of a noncontributory plan.';
  }

  if (/contributory/.test(`${q} ${correct}`) && /(entire cost|paid for by the employer|only employer)/.test(selected)) {
    return 'This removes the employee contribution that defines a contributory plan.';
  }

  if (/grace period/.test(q) && /(effective|beneficiary|death)/.test(selected)) {
    return `"${optionText}" describes a different event, not the overdue-premium window called the grace period.`;
  }

  if (/reinstat/.test(q) && /(grace period|non[- ]forfeiture)/.test(selected)) {
    return `"${optionText}" is a different provision. It does not restore a lapsed policy.`;
  }

  if (/application/.test(q) && /sign/.test(q) && (/\bexcept\b|\bnot\b/.test(q))) {
    return `"${optionText}" is normally one of the required signatures, so it cannot be the exception.`;
  }

  return '';
}

function isLegacyGeneratedFeedback(feedbackText) {
  return /does not fit the key fact this question is testing|stated too absolutely for the facts given|too broad\. Re-check whether|At least one listed option fits the rule better|amount, percentage, or time period in this choice is off|This choice is too absolute\. Re-check whether the facts allow/i.test(String(feedbackText || ''));
}

function isContrastiveFeedback(feedbackText) {
  return /This option incorrectly adds|This option is too restrictive|This option adds a condition|This choice is too absolute|This choice is too broad|This mixes in employee contributions|The number in this choice is off|is the opposite of what the facts show|describes beneficiary order|describes a different event|is not the exception here|is a different provision\. It does not|is a different [a-z- ]+ than the one this question is testing/i.test(String(feedbackText || ''));
}

function isGeneratedFallbackFeedback(feedbackText) {
  const text = String(feedbackText || '');
  return isLegacyGeneratedFeedback(text) || isContrastiveFeedback(text) || /The correct answer is "|The better answer here is "/.test(text);
}

function getExplanationReasonCandidates(question) {
  const explanation = String(question?.explanation || '');
  if (!explanation) return [];

  const stepThreeMatch = explanation.match(/Step\s*3\s*:\s*([\s\S]*?)(?=Step\s*4\s*:|$)/i);
  const stepThree = stepThreeMatch?.[1] || explanation;

  return stepThree
    .replace(/^Eliminate distractors using the facts(?: and remove options that conflict with the scenario)?\.?\s*/i, '')
    .split(/\s*;\s*|\.\s+(?=[A-Z"'])/)
    .map((part) => toSentence(part))
    .filter((part) => part && part.length > 25);
}

function getExplanationReasonForOption(question, optionIndex) {
  const optionText = stripOptionPrefix(question?.options?.[optionIndex] || '');
  const correctText = stripOptionPrefix(question?.options?.[question?.correctAnswer] || '');
  const candidates = getExplanationReasonCandidates(question);

  let bestCandidate = '';
  let bestScore = 0;

  candidates.forEach((candidate) => {
    const optionScore = getKeywordOverlapScore(candidate, optionText);
    const correctScore = getKeywordOverlapScore(candidate, correctText);

    if (optionScore >= 0.34 && optionScore >= correctScore && optionScore > bestScore) {
      bestCandidate = candidate;
      bestScore = optionScore;
    }
  });

  return bestCandidate;
}

function isWrongAnswerFeedbackReliable(question, optionIndex, feedbackText) {
  const cleaned = cleanFeedbackText(feedbackText);
  if (!cleaned) return false;

  if (isLegacyGeneratedFeedback(cleaned)) {
    return false;
  }

  if (isContrastiveFeedback(cleaned)) {
    return true;
  }

  if (/step\s*\d|select the best answer|correct answer|option\s+[a-f0-9]\b/i.test(cleaned)) {
    return false;
  }

  const optionText = stripOptionPrefix(question?.options?.[optionIndex] || '');
  const correctText = stripOptionPrefix(question?.options?.[question?.correctAnswer] || '');
  const optionScore = getKeywordOverlapScore(cleaned, optionText);
  const correctScore = getKeywordOverlapScore(cleaned, correctText);

  const stronglyAffirmsOutcome = /\b(can pay|will pay|is payable|best answer|therefore|so the answer|select|choose|is correct)\b/i.test(cleaned);
  if (stronglyAffirmsOutcome && correctScore > optionScore + 0.2) {
    return false;
  }

  if (/\bneither\b/i.test(optionText) && /\b(can pay|will pay|is payable)\b/i.test(cleaned)) {
    return false;
  }

  if (/\bnone of the above\b/i.test(optionText) && correctScore > optionScore) {
    return false;
  }

  return true;
}

function buildWrongAnswerFallback(question, optionIndex) {
  const optionText = stripOptionPrefix(question?.options?.[optionIndex] || '');
  const correctText = stripOptionPrefix(question?.options?.[question?.correctAnswer] || '');
  const matchedExplanation = getExplanationReasonForOption(question, optionIndex);
  const mismatchReason = getSelectedMismatchReason(question, optionText, correctText);
  const correctReason = getCorrectConceptReason(question, correctText);

  if (matchedExplanation) {
    return matchedExplanation;
  }

  const numberPattern = /\$?\d[\d,]*(?:\.\d+)?%?|\b\d+\s*(?:days?|months?|years?)\b/gi;
  const selectedNumbers = optionText.match(numberPattern) || [];
  const correctNumbers = correctText.match(numberPattern) || [];
  if (selectedNumbers.length > 0 && correctNumbers.length > 0 && selectedNumbers.join('|') !== correctNumbers.join('|')) {
    return correctText
      ? `The number in this choice is off. The correct answer is "${correctText}".`
      : 'The number in this choice is off. Re-check the calculation or eligibility threshold.';
  }

  if (mismatchReason) {
    return correctReason ? `${mismatchReason} ${correctReason}` : mismatchReason;
  }

  if (/\bneither\b/i.test(optionText)) {
    return correctReason
      ? `This choice is too absolute. ${correctReason}`
      : 'This choice is too absolute. At least one listed outcome can still apply under these facts.';
  }

  if (/\bboth\b|\ball of the above\b/i.test(optionText)) {
    return correctReason
      ? `This choice is too broad. ${correctReason}`
      : 'This choice is too broad. The facts support one specific outcome, not every listed statement.';
  }

  if (/\bnone of the above\b/i.test(optionText)) {
    return correctReason
      ? `This choice is too broad. ${correctReason}`
      : 'This choice is too broad because at least one listed option does fit the rule here.';
  }

  if (/\b(always|never|only|must|cannot|can\'t|all)\b/i.test(optionText)) {
    return correctReason
      ? `This choice is too absolute for the facts given. ${correctReason}`
      : 'This choice is too absolute for the facts given. Re-check whether the rule really applies that broadly.';
  }

  if ((/\bexcept\b|\bnot\b/.test(getQuestionPlainText(question).toLowerCase())) && correctReason) {
    return `${correctReason} This question is asking for the exception.`;
  }

  const conceptLabel = getConceptLabel(question, optionText, correctText);
  const optionPreview = optionText.length > 96 ? `${optionText.slice(0, 93).trim()}...` : optionText;
  if (correctReason) {
    return `"${optionPreview}" is a different ${conceptLabel} than the one this question is testing. ${correctReason}`;
  }

  return `"${optionPreview}" is not the best fit for this question. Re-check the key fact the answer is testing.`;
}

function buildCorrectAnswerFeedback(question) {
  const correctText = stripOptionPrefix(question?.options?.[question?.correctAnswer] || '');
  const explanation = String(question?.explanation || '');
  const stepFourMatch = explanation.match(/Step\s*4\s*:\s*Select the best answer\.\s*Option\s*[A-F0-9]+:\s*([\s\S]*?)$/i);
  const stepFourText = toSentence(stepFourMatch?.[1] || '');

  if (stepFourText && getKeywordOverlapScore(stepFourText, correctText) >= 0.34) {
    return stepFourText;
  }

  return `This option best matches the definition, rule, or outcome the question is testing. ${getQuestionFocusText(question)}`;
}

function* walkJsonFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkJsonFiles(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      yield fullPath;
    }
  }
}

const changedFiles = [];
let generatedWrongFeedback = 0;
let repairedMisalignedFeedback = 0;
let filledCorrectFeedback = 0;
let refreshedLegacyFeedback = 0;

for (const fullPath of walkJsonFiles(DATA_DIR)) {
  const relPath = path.relative(ROOT, fullPath);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const questions = Array.isArray(data.questions) ? data.questions : null;
  if (!questions) continue;

  let fileChanged = false;

  questions.forEach((question) => {
    if (!Array.isArray(question.options) || question.options.length === 0) return;

    const feedback = Array.isArray(question.optionFeedback) ? question.optionFeedback.slice() : [];
    if (feedback.length < question.options.length) {
      feedback.length = question.options.length;
    }

    question.options.forEach((_, index) => {
      const currentFeedback = cleanFeedbackText(feedback[index]);

      if (index === question.correctAnswer) {
        if (!currentFeedback) {
          feedback[index] = buildCorrectAnswerFeedback(question);
          fileChanged = true;
          filledCorrectFeedback += 1;
        }
        return;
      }

      if (!currentFeedback) {
        feedback[index] = buildWrongAnswerFallback(question, index);
        fileChanged = true;
        generatedWrongFeedback += 1;
        return;
      }

      if (isGeneratedFallbackFeedback(currentFeedback)) {
        feedback[index] = buildWrongAnswerFallback(question, index);
        fileChanged = true;
        refreshedLegacyFeedback += 1;
        return;
      }

      if (!isWrongAnswerFeedbackReliable(question, index, currentFeedback)) {
        feedback[index] = buildWrongAnswerFallback(question, index);
        fileChanged = true;
        repairedMisalignedFeedback += 1;
      } else {
        feedback[index] = currentFeedback;
      }
    });

    question.optionFeedback = feedback;
  });

  if (fileChanged) {
    fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    changedFiles.push(relPath);
  }
}

console.log(JSON.stringify({
  changedFiles,
  generatedWrongFeedback,
  repairedMisalignedFeedback,
  filledCorrectFeedback,
  refreshedLegacyFeedback
}, null, 2));
