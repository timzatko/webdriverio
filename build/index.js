"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _reporter = _interopRequireDefault(require("@wdio/reporter"));

var _chalk = _interopRequireDefault(require("chalk"));

var _prettyMs = _interopRequireDefault(require("pretty-ms"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class SpecReporter extends _reporter.default {
  constructor(options) {
    options = Object.assign({
      stdout: true
    }, options);
    super(options);
    this.suiteUids = [];
    this.suites = [];
    this.indents = 0;
    this.suiteIndents = {};
    this.defaultTestIndent = '   ';
    this.stateCounts = {
      passed: 0,
      failed: 0,
      skipped: 0
    };
    this.chalk = _chalk.default;
  }

  onSuiteStart(suite) {
    this.suiteUids.push(suite.uid);
    this.suiteIndents[suite.uid] = ++this.indents;
  }

  onSuiteEnd(suite) {
    this.indents--;
    this.suites.push(suite);
  }

  onHookEnd(hook) {
    if (hook.error) {
      this.stateCounts.failed++;
    }
  }

  onTestPass() {
    this.stateCounts.passed++;
  }

  onTestFail() {
    this.stateCounts.failed++;
  }

  onTestSkip() {
    this.stateCounts.skipped++;
  }

  onRunnerEnd(runner) {
    this.printReport(runner);
  }

  printReport(runner) {
    const duration = `(${(0, _prettyMs.default)(runner._duration)})`;
    const preface = `[${this.getEnviromentCombo(runner.capabilities, false, runner.isMultiremote).trim()} #${runner.cid}]`;
    const divider = '------------------------------------------------------------------';
    const results = this.getResultDisplay();

    if (results.length === 0) {
      return;
    }

    const testLinks = runner.isMultiremote ? Object.entries(runner.capabilities).map(([instanceName, capabilities]) => this.getTestLink({
      config: _objectSpread(_objectSpread({}, runner.config), {
        capabilities
      }),
      sessionId: capabilities.sessionId,
      isMultiremote: runner.isMultiremote,
      instanceName
    })) : this.getTestLink(runner);
    const output = [...this.getHeaderDisplay(runner), '', ...results, ...this.getCountDisplay(duration), ...this.getFailureDisplay(), ...(testLinks.length ? ['', ...testLinks] : [])];
    const prefacedOutput = output.map(value => {
      return value ? `${preface} ${value}` : preface;
    });
    this.write(`${divider}\n${prefacedOutput.join('\n')}\n`);
  }

  getTestLink({
    config,
    sessionId,
    isMultiremote,
    instanceName
  }) {
    const isSauceJob = config.hostname && config.hostname.includes('saucelabs') || config.capabilities && (config.capabilities['sauce:options'] || config.capabilities.tunnelIdentifier);

    if (isSauceJob) {
      const dc = config.headless ? '.us-east-1' : ['eu', 'eu-central-1'].includes(config.region) ? '.eu-central-1' : '';
      const multiremoteNote = isMultiremote ? ` ${instanceName}` : '';
      return [`Check out${multiremoteNote} job at https://app${dc}.saucelabs.com/tests/${sessionId}`];
    }

    return [];
  }

  getHeaderDisplay(runner) {
    const combo = this.getEnviromentCombo(runner.capabilities, undefined, runner.isMultiremote).trim();
    const output = [`Spec: ${runner.specs[0]}`, `Running: ${combo}`];

    if (runner.capabilities.sessionId) {
      output.push(`Session ID: ${runner.capabilities.sessionId}`);
      output.push(`BrowserStack: https://automate.browserstack.com/dashboard/v2/search?query=${runner.capabilities.sessionId}&type=sessions`);
    }

    return output;
  }

  getEventsToReport(suite) {
    return [...suite.hooksAndTests.filter(item => {
      return item.type === 'test' || Boolean(item.error);
    })];
  }

  getResultDisplay() {
    const output = [];
    const suites = this.getOrderedSuites();

    for (const suite of suites) {
      if (suite.tests.length === 0 && suite.suites.length === 0 && suite.hooks.length === 0) {
        continue;
      }

      const suiteIndent = this.indent(suite.uid);
      output.push(`${suiteIndent}${suite.title}`);

      if (suite.description) {
        output.push(...suite.description.trim().split('\n').map(l => `${suiteIndent}${this.chalk.grey(l.trim())}`));
        output.push('');
      }

      const eventsToReport = this.getEventsToReport(suite);

      for (const test of eventsToReport) {
        const testTitle = test.title;
        const state = test.state;
        const testIndent = `${this.defaultTestIndent}${suiteIndent}`;
        const sessionId = test.output.length ? test.output[test.output.length - 1].sessionId : '?';
        output.push(`${testIndent}${this.chalk[this.getColor(state)](this.getSymbol(state))} ${testTitle} (https://automate.browserstack.com/dashboard/v2/search?query=${sessionId}&type=sessions)`);

        if (test.argument && test.argument.rows && test.argument.rows.length) {
          const data = (0, _utils.buildTableData)(test.argument.rows);
          const rawTable = (0, _utils.printTable)(data);
          const table = (0, _utils.getFormattedRows)(rawTable, testIndent);
          output.push(...table);
        }
      }

      if (eventsToReport.length) {
        output.push('');
      }
    }

    return output;
  }

  getCountDisplay(duration) {
    const output = [];

    if (this.stateCounts.passed > 0) {
      const text = `${this.stateCounts.passed} passing ${duration}`;
      output.push(this.chalk[this.getColor('passed')](text));
      duration = '';
    }

    if (this.stateCounts.failed > 0) {
      const text = `${this.stateCounts.failed} failing ${duration}`.trim();
      output.push(this.chalk[this.getColor('failed')](text));
      duration = '';
    }

    if (this.stateCounts.skipped > 0) {
      const text = `${this.stateCounts.skipped} skipped ${duration}`.trim();
      output.push(this.chalk[this.getColor('skipped')](text));
    }

    return output;
  }

  getFailureDisplay() {
    let failureLength = 0;
    const output = [];
    const suites = this.getOrderedSuites();

    for (const suite of suites) {
      const suiteTitle = suite.title;
      const eventsToReport = this.getEventsToReport(suite);

      for (const test of eventsToReport) {
        if (test.state !== 'failed') {
          continue;
        }

        const testTitle = test.title;
        const errors = test.errors || [test.error];
        output.push('', `${++failureLength}) ${suiteTitle} ${testTitle}`);

        for (let error of errors) {
          output.push(this.chalk.red(error.message));

          if (error.stack) {
            output.push(...error.stack.split(/\n/g).map(value => this.chalk.gray(value)));
          }
        }
      }
    }

    return output;
  }

  getOrderedSuites() {
    if (this.orderedSuites) {
      return this.orderedSuites;
    }

    this.orderedSuites = [];

    for (const uid of this.suiteUids) {
      for (const suite of this.suites) {
        if (suite.uid !== uid) {
          continue;
        }

        this.orderedSuites.push(suite);
      }
    }

    return this.orderedSuites;
  }

  indent(uid) {
    const indents = this.suiteIndents[uid];
    return indents === 0 ? '' : Array(indents).join('    ');
  }

  getSymbol(state) {
    let symbol = '?';

    switch (state) {
      case 'passed':
        symbol = '✓';
        break;

      case 'skipped':
        symbol = '-';
        break;

      case 'failed':
        symbol = '✖';
        break;
    }

    return symbol;
  }

  getColor(state) {
    let color = null;

    switch (state) {
      case 'passed':
        color = 'green';
        break;

      case 'pending':
      case 'skipped':
        color = 'cyan';
        break;

      case 'failed':
        color = 'red';
        break;
    }

    return color;
  }

  getEnviromentCombo(caps, verbose = true, isMultiremote = false) {
    const device = caps.deviceName;
    const browser = isMultiremote ? 'MultiremoteBrowser' : caps.browserName || caps.browser;
    const version = caps.browserVersion || caps.version || caps.platformVersion || caps.browser_version;
    const platform = caps.platformName || caps.platform || (caps.os ? caps.os + (caps.os_version ? ` ${caps.os_version}` : '') : '(unknown)');

    if (device) {
      const program = (caps.app || '').replace('sauce-storage:', '') || caps.browserName;
      const executing = program ? `executing ${program}` : '';

      if (!verbose) {
        return `${device} ${platform} ${version}`;
      }

      return `${device} on ${platform} ${version} ${executing}`.trim();
    }

    if (!verbose) {
      return (browser + (version ? ` ${version} ` : ' ') + platform).trim();
    }

    return browser + (version ? ` (v${version})` : '') + ` on ${platform}`;
  }

}

var _default = SpecReporter;
exports.default = _default;