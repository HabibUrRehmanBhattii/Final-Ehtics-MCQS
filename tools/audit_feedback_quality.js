const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9$% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanFeedback(value) {
  return String(value || '')
    .replace(/^incorrect\.\s*/i, '')
    .replace(/^correct\.\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function optionText(value) {
  return String(value || '')
    .replace(/^\s*(?:\(?\s*[A-Fa-f1-6]\s*\)?\s*[.):\-]?)\s+/, '')
    .trim();
}

function keywordTokens(value) {
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

function overlapScore(text, reference) {
  const textTokens = new Set(keywordTokens(text));
  const refTokens = new Set(keywordTokens(reference));

  if (!textTokens.size || !refTokens.size) return 0;

  let matches = 0;
  textTokens.forEach((token) => {
    if (refTokens.has(token)) {
      matches += 1;
    }
  });

  return matches / Math.min(textTokens.size, refTokens.size);
}

function isLikelyMisaligned(question, optionIndex, feedbackText) {
  if (!feedbackText) return true;
  if (isContrastiveFeedback(feedbackText)) {
    return false;
  }

  if (/step\s*\d|select the best answer|correct answer|option\s+[a-f0-9]\b/i.test(feedbackText)) {
    return true;
  }

  const selected = optionText(question.options[optionIndex]);
  const correct = optionText(question.options[question.correctAnswer] || '');
  const selectedScore = overlapScore(feedbackText, selected);
  const correctScore = overlapScore(feedbackText, correct);
  const stronglyAffirmsOutcome = /\b(can pay|will pay|is payable|best answer|therefore|so the answer|select|choose|is correct)\b/i.test(feedbackText);

  if (stronglyAffirmsOutcome && correctScore > selectedScore + 0.2) {
    return true;
  }

  if (/\bneither\b/i.test(selected) && /\b(can pay|will pay|is payable)\b/i.test(feedbackText)) {
    return true;
  }

  if (/\bnone of the above\b/i.test(selected) && correctScore > selectedScore) {
    return true;
  }

  return false;
}

function isLegacyGeneratedFeedback(feedbackText) {
  return /does not fit the key fact this question is testing|stated too absolutely for the facts given|too broad\. Re-check whether|At least one listed option fits the rule better|amount, percentage, or time period in this choice is off|This choice is too absolute\. Re-check whether the facts allow/i.test(String(feedbackText || ''));
}

function isContrastiveFeedback(feedbackText) {
  return /This option incorrectly adds|This option is too restrictive|This option adds a condition|This choice is too absolute|This choice is too broad|This mixes in employee contributions|The number in this choice is off|is the opposite of what the facts show|describes beneficiary order|describes a different event|is not the exception here|is a different provision\. It does not|is a different [a-z- ]+ than the one this question is testing/i.test(String(feedbackText || ''));
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

const findings = [];
const showFullFindings = process.argv.includes('--full');

for (const fullPath of walkJsonFiles(DATA_DIR)) {
  const relPath = path.relative(ROOT, fullPath);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const questions = Array.isArray(data.questions) ? data.questions : [];

  questions.forEach((question) => {
    const options = Array.isArray(question.options) ? question.options : [];
    const feedback = Array.isArray(question.optionFeedback) ? question.optionFeedback : [];

    options.forEach((option, index) => {
      if (index === question.correctAnswer) return;

      const cleanedFeedback = cleanFeedback(feedback[index]);
      if (!cleanedFeedback) {
        findings.push({
          file: relPath,
          id: question.id,
          option: index,
          issue: 'missing_wrong_feedback',
          optionText: optionText(option)
        });
        return;
      }

      if (isLegacyGeneratedFeedback(cleanedFeedback)) {
        findings.push({
          file: relPath,
          id: question.id,
          option: index,
          issue: 'legacy_generated_feedback',
          optionText: optionText(option),
          feedback: cleanedFeedback
        });
        return;
      }

      if (isLikelyMisaligned(question, index, cleanedFeedback)) {
        findings.push({
          file: relPath,
          id: question.id,
          option: index,
          issue: 'likely_misaligned_feedback',
          optionText: optionText(option),
          feedback: cleanedFeedback
        });
      }
    });
  });
}

const summaryByIssue = findings.reduce((summary, finding) => {
  summary[finding.issue] = (summary[finding.issue] || 0) + 1;
  return summary;
}, {});

console.log(JSON.stringify({
  totalFindings: findings.length,
  summaryByIssue,
  sampleFindings: showFullFindings ? undefined : findings.slice(0, 60),
  findings: showFullFindings ? findings : undefined
}, null, 2));
