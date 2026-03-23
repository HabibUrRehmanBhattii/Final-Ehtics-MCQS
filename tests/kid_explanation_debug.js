/**
 * Debug Helper for Kid's Explanation Feature
 * Run these commands in browser console (F12) to diagnose issues
 */

const KidExplanationDebug = {
  /**
   * Check all aspects and generate a comprehensive report
   * Usage: KidExplanationDebug.diagnosticReport()
   */
  diagnosticReport() {
    console.clear();
    console.log('%c🔍 KID\'S EXPLANATION DIAGNOSTIC REPORT', 'font-size: 16px; color: #3b82f6; font-weight: bold;');
    console.log('═'.repeat(60));

    const report = {
      timestamp: new Date().toISOString(),
      appVersion: MCQApp?.appBuildVersion,
      cacheVersion: MCQApp?.cacheVersion,
      browserUA: navigator.userAgent.substring(0, 50),
      htmlElements: {},
      currentQuestion: null,
      dataLoaded: false,
      kidExplanationStatus: 'UNKNOWN'
    };

    // Check HTML elements
    console.log('\n%c1️⃣  HTML ELEMENTS', 'font-weight: bold; color: #10b981;');
    const kidBox = document.getElementById('kid-explanation-box');
    const kidText = document.getElementById('kid-explanation-text');
    const kidLabel = document.getElementById('kid-explanation-label');

    report.htmlElements = {
      kidExplanationBox: !!kidBox,
      kidExplanationText: !!kidText,
      kidExplanationLabel: !!kidLabel
    };

    console.log(`  ✓ kid-explanation-box: ${kidBox ? '✅ Found' : '❌ Missing'}`);
    console.log(`  ✓ kid-explanation-text: ${kidText ? '✅ Found' : '❌ Missing'}`);
    console.log(`  ✓ kid-explanation-label: ${kidLabel ? '✅ Found' : '❌ Missing'}`);

    // Check app state
    console.log('\n%c2️⃣  APP STATE', 'font-weight: bold; color: #10b981;');
    console.log(`  ✓ MCQApp initialized: ${MCQApp ? '✅ Yes' : '❌ No'}`);
    console.log(`  ✓ Questions loaded: ${MCQApp?.state?.questions?.length || 0} questions`);
    console.log(`  ✓ Current question index: ${MCQApp?.state?.currentQuestionIndex || 'N/A'}`);

    // Check current question
    if (MCQApp?.state?.questions?.length > 0) {
      const idx = MCQApp.state.currentQuestionIndex;
      const question = MCQApp.state.questions[idx];

      if (question) {
        report.currentQuestion = {
          id: question.id,
          hasExplanation: !!question.explanation,
          hasKidExplanation: !!question.kidExplanation,
          kidExplanationLength: question.kidExplanation?.length || 0
        };

        console.log('\n%c3️⃣  CURRENT QUESTION', 'font-weight: bold; color: #10b981;');
        console.log(`  ✓ Question ID: ${question.id}`);
        console.log(`  ✓ Has explanation: ${question.explanation ? '✅ Yes' : '❌ No'}`);
        console.log(`  ✓ Has kidExplanation: ${question.kidExplanation ? '✅ Yes' : '❌ No'}`);
        if (question.kidExplanation) {
          console.log(`  ✓ Kid explanation length: ${question.kidExplanation.length} chars`);
          console.log(`  ✓ Preview: "${question.kidExplanation.substring(0, 80)}..."`);
        }
      }
    }

    // Check display state
    console.log('\n%c4️⃣  DISPLAY STATE', 'font-weight: bold; color: #10b981;');
    if (kidBox) {
      console.log(`  ✓ Kid box visible: ${kidBox.style.display !== 'none' ? '✅ Yes' : '❌ No'}`);
      console.log(`  ✓ Kid box display style: "${kidBox.style.display}"`);
      console.log(`  ✓ Kid text content: ${kidText?.innerHTML?.length || 0} chars`);
    }

    // Recommendations
    console.log('\n%c5️⃣  RECOMMENDATIONS', 'font-weight: bold; color: #f59e0b;');
    const issues = [];

    if (!kidBox || !kidText || !kidLabel) {
      issues.push('❌ Missing HTML elements - check index.html');
    }
    if (!MCQApp) {
      issues.push('❌ MCQApp not loaded - check js/app.js');
    }
    if (MCQApp?.state?.questions?.length === 0) {
      issues.push('❌ Questions not loaded - check data files');
    }
    if (kidBox && kidBox.style.display === 'none' && MCQApp?.state?.answersRevealed?.size > 0) {
      issues.push('⚠️ Kid box hidden - may need to answer a question first');
    }

    if (issues.length === 0) {
      console.log('  ✅ All checks passed! Kid explanations should be working.');
      report.kidExplanationStatus = 'OK';
    } else {
      issues.forEach(issue => console.log(`  ${issue}`));
      report.kidExplanationStatus = 'ISSUES_FOUND';
    }

    // Export report
    console.log('\n%c6️⃣  FULL REPORT (Copy this)', 'font-weight: bold; color: #8b5cf6;');
    console.table(report);

    return report;
  },

  /**
   * Check specific question for kid explanation
   * Usage: KidExplanationDebug.checkQuestion(1)
   */
  checkQuestion(questionId) {
    console.log(`\n%c🔍 Checking Question ${questionId}`, 'font-size: 14px; color: #3b82f6; font-weight: bold;');

    const question = MCQApp?.state?.questions?.find(q => q.id === questionId);

    if (!question) {
      console.log(`❌ Question ${questionId} not found`);
      return null;
    }

    console.log('Question Details:');
    console.table({
      'Question ID': question.id,
      'Main Explanation': question.explanation ? `✅ (${question.explanation.length} chars)` : '❌ Missing',
      'Kid Explanation': question.kidExplanation ? `✅ (${question.kidExplanation.length} chars)` : '❌ Missing',
      'Has Options': Array.isArray(question.options) ? `✅ ${question.options.length}` : '❌'
    });

    if (question.kidExplanation) {
      console.log('\n📖 Kid Explanation Preview:');
      console.log(`"${question.kidExplanation}"`);
    }

    return question;
  },

  /**
   * Manually display kid explanation for current question
   * Usage: KidExplanationDebug.forceDisplay()
   */
  forceDisplay() {
    console.log('\n🔧 Forcing kid explanation display...');

    const kidBox = document.getElementById('kid-explanation-box');
    const kidText = document.getElementById('kid-explanation-text');

    if (!kidBox || !kidText) {
      console.log('❌ HTML elements not found');
      return false;
    }

    const idx = MCQApp?.state?.currentQuestionIndex;
    const question = MCQApp?.state?.questions?.[idx];

    if (!question) {
      console.log('❌ No question loaded');
      return false;
    }

    if (!question.kidExplanation) {
      console.log('❌ Question has no kidExplanation field');
      return false;
    }

    // Force display
    kidText.innerHTML = question.kidExplanation;
    kidBox.style.display = 'block';

    console.log('✅ Kid explanation force-displayed');
    console.log(`Question ${question.id}: "${question.kidExplanation.substring(0, 80)}..."`);

    return true;
  },

  /**
   * Clear cache and reload page
   * Usage: KidExplanationDebug.clearAndReload()
   */
  clearAndReload() {
    console.log('\n🔄 Clearing cache and reloading...');
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
        location.reload();
      });
    } else {
      // Fallback for browsers without cache API
      localStorage.clear();
      sessionStorage.clear();
      location.reload();
    }
  },

  /**
   * List all questions with kid explanation status
   * Usage: KidExplanationDebug.listAllQuestions()
   */
  listAllQuestions() {
    console.log('\n📋 All Questions Status:');

    const questions = MCQApp?.state?.questions || [];
    const summary = {
      total: questions.length,
      withKidExplanation: 0,
      withoutKidExplanation: 0,
      empty: 0
    };

    const data = questions.map(q => ({
      'ID': q.id,
      'Has Kid Explanation': q.kidExplanation ? '✅' : '❌',
      'Length': q.kidExplanation?.length || 0,
      'Preview': q.kidExplanation ? q.kidExplanation.substring(0, 50) + '...' : 'N/A'
    }));

    questions.forEach(q => {
      if (q.kidExplanation) summary.withKidExplanation++;
      else summary.withoutKidExplanation++;
    });

    console.table(data);
    console.log(`\nSummary: ${summary.withKidExplanation}/${summary.total} have kid explanations`);

    return summary;
  },

  /**
   * Verify JSON files are loaded correctly
   * Usage: await KidExplanationDebug.verifyJsonFiles()
   */
  async verifyJsonFiles() {
    console.log('\n📡 Verifying JSON files...');

    const files = [
      'data/llqp-life/hllqp-life-06-part-1.json',
      'data/llqp-life/hllqp-life-07-part-1.json',
      'data/llqp-life/hllqp-life-08-part-1.json'
    ];

    for (const file of files) {
      try {
        const response = await fetch(file);
        const data = await response.json();
        const count = data.data?.length || 0;
        const withKid = data.data?.filter(q => q.kidExplanation)?.length || 0;

        console.log(`✅ ${file}: ${withKid}/${count} have kidExplanation`);
      } catch (error) {
        console.log(`❌ ${file}: ${error.message}`);
      }
    }
  },

  /**
   * Print help text
   * Usage: KidExplanationDebug.help()
   */
  help() {
    console.clear();
    console.log('%c🧪 KID\'S EXPLANATION DEBUG CONSOLE', 'font-size: 16px; color: #3b82f6; font-weight: bold;');
    console.log('═'.repeat(60));
    console.log('\nAvailable Commands:\n');
    console.log('  KidExplanationDebug.diagnosticReport()');
    console.log('    → Run comprehensive diagnostic and generate report\n');
    console.log('  KidExplanationDebug.checkQuestion(id)');
    console.log('    → Check specific question (e.g., checkQuestion(1))\n');
    console.log('  KidExplanationDebug.forceDisplay()');
    console.log('    → Manually display kid explanation for current question\n');
    console.log('  KidExplanationDebug.listAllQuestions()');
    console.log('    → List all questions and their kid explanation status\n');
    console.log('  await KidExplanationDebug.verifyJsonFiles()');
    console.log('    → Verify JSON files are properly loaded\n');
    console.log('  KidExplanationDebug.clearAndReload()');
    console.log('    → Clear cache and reload page\n');
    console.log('  KidExplanationDebug.help()');
    console.log('    → Show this help text\n');
    console.log('═'.repeat(60));
  }
};

// Make globally accessible
window.KidExplanationDebug = KidExplanationDebug;

// Auto-print help on console load
if (!window.debugHelpPrinted) {
  console.log('%c💡 Tip: Run KidExplanationDebug.help() in console', 'color: #3b82f6; font-size: 12px;');
  window.debugHelpPrinted = true;
}
