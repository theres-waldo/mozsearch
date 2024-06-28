"use strict";

/**
 * A class for communication with webtest command.
 */
class TestHarness {
  /**
   * Logs generated by TestHarness.log and wrappers, which are not
   * yet sent to webtest command.
   */
  static pendingLogs = [];

  /**
   * List of test functions added by add_task (or TestHarness.addTest)
   */
  static tests = [];

  /**
   * Add log, this is sent to webtest command and also shown in console.
   *
   * @param {String} type
   *        See tools/src/cmd_pipeline/cmd_webtest.rs for the list.
   * @param {String} msg
   *        The message for the log.
   */
  static log(type, msg) {
    console.log(`${type} - ${msg}`);
    this.pendingLogs.push([type, `${msg}`]);
  }

  // Wrappers for logging.

  static pass(msg) {
    this.log("PASS", msg);
  }

  static fail(msg) {
    this.log("FAIL", msg);
    this.log("STACK", new Error().stack);
  }

  static info(msg) {
    this.log("INFO", msg);
  }

  /**
   * Add a test function which is an asynchronous function.
   *
   * @param {Function} func
   *        An async function to be run.
   */
  static addTest(func) {
    this.tests.push(func);
  }

  /**
   * Run all subtests and clear them.
   */
  static async runTests() {
    window.frame = document.querySelector("#frame");

    try {
      for (const func of this.tests) {
        this.log("SUBTEST", func.name);
        this.info(`Entering test ${func.name}`);
        await func();
        this.info(`Leaving test ${func.name}`);
      }
    } catch (e) {
      this.log("FAIL", e.toString());
      this.log("STACK", e.stack);
    }

    this.tests.length = 0;
  }

  /**
   * Load a test file specified by `path`.
   * Once the test file is loaded, all subtests added by the file
   * are executed.
   *
   * This is called by webtest.
   *
   * @param {String} path
   *        The full path to the test, starting with "tests/webtest/"
   */
  static loadTest(path) {
    if (!path.startsWith("tests/webtest/")) {
      this.fail(`Unsupported test path ${path}`);
      return;
    }

    this.log("TEST_START", path);

    const script = document.createElement("script");
    script.src = `/${path}`;
    const onError = e => {
      this.log("FAIL", e.message);
    };
    window.addEventListener("error", onError);
    script.addEventListener("load", async () => {
      window.removeEventListener("error", onError);
      await this.runTests();
      this.log("TEST_END", path);
    });
    document.body.append(script);
  }

  /**
   * Returns newly added logs, and clear the log.
   *
   * This is called by webtest.
   *
   * @returns {Array<[String, Sring]>}
   *          List of logs
   */
  static getNewLogs() {
    const logs = this.pendingLogs.slice();
    this.pendingLogs.length = 0;
    return logs;
  }
}
window.TestHarness = TestHarness;

/**
 * A class provides utility functions for each testcase.
 */
class TestUtils {
  /**
   * Search functionality has timeout for reflecting user input to
   * query field and location.
   *
   * Shorten the timeout for the current page, in order to reduce the
   * time taken by the test.
   */
  static shortenSearchTimeouts() {
    const frame = document.querySelector("#frame");
    frame.contentWindow.Dxr.timeouts.search = 10;
    frame.contentWindow.Dxr.timeouts.history = 20;
  }

  /**
   * Load searchfox page and wait for load.
   *
   * @param {String} path
   *        The path part of the URL.
   * @returns {Promise<undefined>}
   *          Resolves when the page is loaded.
   */
  static async loadPath(path) {
    const loadPromise = this.waitForLoad();

    this.info(`Loading ${path}`);

    const frame = document.querySelector("#frame");
    frame.src = path;

    await loadPromise;
  }

  /**
   * Wait for the subsequent page load.
   * This also waits for pageshow event, given the context menu
   * relies on the pageshow to be dispatched before starting interacting.
   *
   * @returns {Promise<undefined>}
   *          Resolves when the subsequent page load finishes.
   */
  static async waitForLoad() {
    this.info(`Waiting for load`);

    const frame = document.querySelector("#frame");
    const loadEvent = Promise.withResolvers();
    const pageshowEvent = Promise.withResolvers();

    frame.addEventListener("load", () => {
      this.info(`Observed load event`);
      frame.contentWindow.addEventListener("pageshow", () => {
        this.info(`Observed pageshow event`);
        pageshowEvent.resolve();
      }, { once: true });
      loadEvent.resolve();
    }, { once: true });

    await Promise.all([
      loadEvent.promise,
      pageshowEvent.promise,
    ]);
  }

  /**
   * Emulate setting a text on an input element, with dispating input events.
   *
   * @param {Element} elem
   *        The input element.
   * @param {String} text
   *        The text for the element.
   */
  static setText(elem, text) {
    this.info(`Setting text ${text}`);

    elem.value = text;
    const ev = new InputEvent("input", { bubbles: true });
    elem.dispatchEvent(ev);
  }

  /**
   * Emulate clicking a checkbox.
   *
   * @param {Element} elem
   *        The input element.
   */
  static clickCheckbox(elem) {
    this.info(`Clicking checkbox`);

    elem.checked = !elem.checked;
    const ev = new Event("change", { bubbles: true });
    elem.dispatchEvent(ev);
  }

  /**
   * Emulate clicking on link etc.
   *
   * @param {Element} elem
   *        The element to be clicked.
   */
  static click(elem) {
    this.info(`Clicking`);

    const ev = new MouseEvent("click", { bubbles: true });
    elem.dispatchEvent(ev);
  }

  /**
   * Returns a promise that resolves when timeout is exceeded.
   *
   * @returns {Promise<undefined>}
   *          Resolves when timeout is exceeded.
   */
  static sleep(timeout) {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }

  /**
   * Will poll a condition function until it returns true.
   *
   * @param {Function} condition
   *        A condition function that must return true or false.
   * @param {String} msg
   *        The message for logging.
   * @param {Number} interval
   *        The time interval to poll the condition function. Defaults
   *        to 100ms.
   * @param {Number} maxTries
   *        The number of times to poll before giving up and rejecting
   *        if the condition has not yet returned true. Defaults to 50
   *        (~5 seconds for 100ms intervals)
   * @return {Promise<undefined>}
   *         Resolves when condition is true.
   *         Rejects if timeout is exceeded or condition ever throws.
   */
  static async waitForCondition(condition, msg, interval=100, maxTries=50) {
    this.info(`Waiting for condition: ${msg}`);

    for (let i = 0; i < maxTries; i ++) {
      if (condition()) {
        TestHarness.pass(msg);
        return;
      }

      await this.sleep(interval);
    }

    TestHarness.fail(`${msg} - timed out after ${maxTries} tries.`);
  }

  /**
   * Returns true if the element is set to be shown.
   *
   * @param {Element} elem
   *        The element.
   */
  static isShown(elem) {
    return window.getComputedStyle(elem).display != "none";
  }

  /**
   * Wait until the element becomes shown.
   *
   * @param {Element} elem
   *        The element.
   * @return {Promise<undefined>}
   *         Resolves when the element becomes shown.
   */
  static async waitForShown(elem, ...args) {
    this.waitForCondition(() => {
      return this.isShown(elem);
    }, ...args);
  }

  /**
   * Test if the condition is true.
   *
   * @param {bool} condition
   *        If this is true, this test passes.
   *        Otherwise fails.
   * @param {String} msg
   *        The message for the condition.
   */
  static ok(condition, msg) {
    if (condition) {
      TestHarness.pass(msg);
    } else {
      TestHarness.fail(msg);
    }
  }

  /**
   * Test if the two values are equivalent.
   *
   * @param {any} actual
   *        The actual value.
   * @param {any} expected
   *        The expected value.
   * @param {String} msg
   *        The message for the condition.
   */
  static is(actual, expected, msg) {
    if (Object.is(actual, expected)) {
      TestHarness.pass(msg);
    } else {
      TestHarness.fail(`${msg} - Got ${actual}, expected ${expected}`);
    }
  }

  /**
   * Test if the two values are not equivalent.
   *
   * @param {any} actual
   *        The actual value.
   * @param {any} expected
   *        The unexpected value.
   * @param {String} msg
   *        The message for the condition.
   */
  static isnot(a, b, msg) {
    if (Object.is(a, b)) {
      TestHarness.fail(`${msg} - Didn't expect ${a}, but got it`);
    } else {
      TestHarness.pass(msg);
    }
  }

  /**
   * Show informative log.
   *
   * @param {String} msg
   *        The log message.
   */
  static info(msg) {
    TestHarness.info(msg);
  }
}
window.TestUtils = TestUtils;

for (const name of [
  "waitForCondition",
  "waitForShown",
  "ok",
  "is",
  "isnot",
  "info",
]) {
  window[name] = TestUtils[name].bind(TestUtils);
}

function add_task(func) {
  TestHarness.addTest(func);
}
