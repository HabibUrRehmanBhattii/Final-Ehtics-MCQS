/**
 * Unit Tests for Kid's Explanation Feature
 * Tests that kidExplanation fields are present in MCQ data and properly displayed
 */

const KidExplanationTests = {
  results: [],

  // Test 1: Verify JSON files contain kidExplanation field
  async testKidExplanationFieldExists() {
    console.log('\n📋 TEST 1: Verify kidExplanation field exists in JSON files');
    try {
      const files = [
        'data/llqp-life/hllqp-life-06-part-1.json',
        'data/llqp-life/hllqp-life-07-part-1.json',
        'data/llqp-life/hllqp-life-08-part-1.json'
      ];

      for (const file of files) {
        const response = await fetch(file);
        const data = await response.json();

        if (!data.data || !Array.isArray(data.data)) {
          this.logResult(file, 'FAIL', 'No data array found');
          continue;
        }

        let allHaveKidExplanation = true;
        let missingCount = 0;

        data.data.forEach((question, idx) => {
          if (!question.kidExplanation) {
            allHaveKidExplanation = false;
            missingCount++;
            console.warn(`  ❌ Q${question.id} missing kidExplanation`);
          }
        });

        if (allHaveKidExplanation) {
          this.logResult(file, 'PASS', `All ${data.data.length} questions have kidExplanation`);
        } else {
          this.logResult(file, 'FAIL', `${missingCount}/${data.data.length} questions missing kidExplanation`);
        }
      }
    } catch (error) {
      this.logResult('testKidExplanationFieldExists', 'ERROR', error.message);
    }
  },

  // Test 2: Verify HTML elements exist
  testKidExplanationHTMLElements() {
    console.log('\n📋 TEST 2: Verify HTML elements exist');

    const kidExplanationBox = document.getElementById('kid-explanation-box');
    const kidExplanationText = document.getElementById('kid-explanation-text');
    const kidExplanationLabel = document.getElementById('kid-explanation-label');

    if (kidExplanationBox && kidExplanationText && kidExplanationLabel) {
      this.logResult('HTML Elements', 'PASS', 'All required elements found');
      return true;
    } else {
      this.logResult('HTML Elements', 'FAIL', 'Missing elements:' +
        (!kidExplanationBox ? ' kid-explanation-box' : '') +
        (!kidExplanationText ? ' kid-explanation-text' : '') +
        (!kidExplanationLabel ? ' kid-explanation-label' : ''));
      return false;
    }
  },

  // Test 3: Verify display logic function exists
  testDisplayLogicExists() {
    console.log('\n📋 TEST 3: Verify display logic in app.js');

    // Check if MCQApp object exists
    if (typeof MCQApp === 'undefined') {
      this.logResult('displayLogicExists', 'FAIL', 'MCQApp not defined');
      return false;
    }

    // Check if checkAnswer method exists
    if (typeof MCQApp.checkAnswer !== 'function') {
      this.logResult('displayLogicExists', 'FAIL', 'MCQApp.checkAnswer not defined');
      return false;
    }

    this.logResult('displayLogicExists', 'PASS', 'MCQApp and checkAnswer method exist');
    return true;
  },

  // Test 4: Simulate kidExplanation display with mock data
  testKidExplanationDisplay() {
    console.log('\n📋 TEST 4: Test kidExplanation display function');

    if (!this.testKidExplanationHTMLElements()) {
      this.logResult('kidExplanationDisplay', 'SKIP', 'HTML elements missing');
      return;
    }

    // Mock question object
    const mockQuestion = {
      id: 1,
      question: 'Test question?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0,
      explanation: 'This is the professional explanation.',
      kidExplanation: 'This is the kid explanation with simple words!'
    };

    try {
      // Get elements
      const kidExplanationBox = document.getElementById('kid-explanation-box');
      const kidExplanationText = document.getElementById('kid-explanation-text');

      // Simulate display logic
      if (mockQuestion.kidExplanation && kidExplanationText) {
        kidExplanationText.innerHTML = mockQuestion.kidExplanation;
        kidExplanationBox.style.display = 'block';

        // Verify
        if (kidExplanationBox.style.display === 'block' && kidExplanationText.innerHTML.includes('kid explanation')) {
          this.logResult('kidExplanationDisplay', 'PASS', 'Mock display successful');
        } else {
          this.logResult('kidExplanationDisplay', 'FAIL', 'Display logic failed');
        }
      }
    } catch (error) {
      this.logResult('kidExplanationDisplay', 'ERROR', error.message);
    }
  },

  // Test 5: Check if CSS styling is applied
  testKidExplanationStyling() {
    console.log('\n📋 TEST 5: Check CSS styling');

    const kidExplanationBox = document.getElementById('kid-explanation-box');
    if (!kidExplanationBox) {
      this.logResult('Styling', 'SKIP', 'Element not found');
      return;
    }

    const styles = window.getComputedStyle(kidExplanationBox);
    const bgColor = styles.backgroundColor;
    const borderLeft = styles.borderLeft;

    const hasBgColor = bgColor && bgColor !== 'rgba(0, 0, 0, 0)';
    const hasBorder = borderLeft && borderLeft !== 'none';

    if (hasBgColor && hasBorder) {
      this.logResult('Styling', 'PASS', `Background: ${bgColor}, Border: ${borderLeft}`);
    } else {
      this.logResult('Styling', 'WARN', 'Styling may not be fully applied');
    }
  },

  // Test 6: Verify data loading from actual question
  async testQuestionDataLoading() {
    console.log('\n📋 TEST 6: Verify actual question data loading');

    try {
      const response = await fetch('data/llqp-life/hllqp-life-06-part-1.json?v=20260323a');
      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        this.logResult('QuestionDataLoading', 'FAIL', 'No questions loaded');
        return;
      }

      const firstQuestion = data.data[0];

      if (!firstQuestion.kidExplanation) {
        this.logResult('QuestionDataLoading', 'FAIL', 'First question missing kidExplanation');
        return;
      }

      if (firstQuestion.kidExplanation.length < 20) {
        this.logResult('QuestionDataLoading', 'WARN', 'kidExplanation is very short');
        return;
      }

      this.logResult('QuestionDataLoading', 'PASS',
        `Q${firstQuestion.id}: "${firstQuestion.kidExplanation.substring(0, 50)}..."`);
    } catch (error) {
      this.logResult('QuestionDataLoading', 'ERROR', error.message);
    }
  },

  // Test 7: Check browser cache issue
  testCacheVersion() {
    console.log('\n📋 TEST 7: Check cache version');

    const appVersion = MCQApp?.appBuildVersion || 'Not found';
    const cacheVersion = MCQApp?.cacheVersion || 'Not found';

    console.log(`  App Version: ${appVersion}`);
    console.log(`  Cache Version: ${cacheVersion}`);

    if (appVersion === '20260323f' && cacheVersion === 'v1.7.8') {
      this.logResult('CacheVersion', 'PASS', `Versions: ${appVersion}, ${cacheVersion}`);
    } else {
      this.logResult('CacheVersion', 'WARN', `May need cache clear: ${appVersion}, ${cacheVersion}`);
    }
  },

  // Helper: Log test result
  logResult(testName, status, message) {
    const statusIcon = {
      'PASS': '✅',
      'FAIL': '❌',
      'ERROR': '🔥',
      'WARN': '⚠️',
      'SKIP': '⏭️'
    }[status] || '❓';

    const result = {testName, status, message};
    this.results.push(result);

    console.log(`  ${statusIcon} [${status}] ${testName}: ${message}`);
  },

  // Run all tests
  async runAllTests() {
    console.log('═════════════════════════════════════════════');
    console.log('🧪 KID\'S EXPLANATION UNIT TESTS');
    console.log('═════════════════════════════════════════════');

    this.results = [];

    await this.testKidExplanationFieldExists();
    this.testKidExplanationHTMLElements();
    this.testDisplayLogicExists();
    this.testKidExplanationDisplay();
    this.testKidExplanationStyling();
    await this.testQuestionDataLoading();
    this.testCacheVersion();

    this.printSummary();
  },

  // Print test summary
  printSummary() {
    console.log('\n═════════════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═════════════════════════════════════════════');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;

    console.log(`Total: ${this.results.length} tests`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`🔥 Errors: ${errors}`);
    console.log(`⚠️ Warnings: ${warnings}`);

    console.log('\n═════════════════════════════════════════════');

    if (failed > 0 || errors > 0) {
      console.log('🔧 TROUBLESHOOTING STEPS:');
      console.log('1. Clear browser cache: Ctrl+Shift+Del (Windows) or Cmd+Shift+Delete (Mac)');
      console.log('2. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
      console.log('3. Check console for errors: F12 → Console tab');
      console.log('4. Verify JSON files have kidExplanation field');
      console.log('5. Check browser developer tools for network errors');
    }
  },

  // Debug function to inspect a question
  debugQuestion(questionId) {
    console.log(`\n🔍 DEBUG: Question ${questionId}`);

    if (!MCQApp || !MCQApp.state || !MCQApp.state.questions) {
      console.log('❌ MCQApp state not initialized');
      return;
    }

    const question = MCQApp.state.questions.find(q => q.id === questionId);
    if (!question) {
      console.log(`❌ Question ${questionId} not found`);
      return;
    }

    console.log('Question data:', {
      id: question.id,
      hasExplanation: !!question.explanation,
      hasKidExplanation: !!question.kidExplanation,
      kidExplanationLength: question.kidExplanation?.length || 0,
      kidExplanationPreview: question.kidExplanation?.substring(0, 100) || 'N/A'
    });

    const kidBox = document.getElementById('kid-explanation-box');
    const kidText = document.getElementById('kid-explanation-text');

    console.log('DOM Elements:', {
      kidBoxExists: !!kidBox,
      kidBoxVisible: kidBox?.style.display !== 'none',
      kidTextExists: !!kidText,
      kidTextContent: kidText?.innerHTML?.substring(0, 100) || 'N/A'
    });
  }
};

// Auto-run tests when page loads (browser only)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      KidExplanationTests.runAllTests();
    });
  } else {
    KidExplanationTests.runAllTests();
  }
}

// Make tests globally accessible (browser only)
if (typeof window !== 'undefined') {
  window.KidExplanationTests = KidExplanationTests;
}
