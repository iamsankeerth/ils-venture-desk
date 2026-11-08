/*
 * Offline React compatibility layer for the Mesa ILS demonstration.
 * Renders existing function components through vendored React 16 class components,
 * supporting the hooks used by this project (useState, useEffect, useMemo,
 * useCallback, useRef). This is NOT React 19 or a general React replacement.
 * It is intentionally scoped to the unmodified ILS component source.
 */
(function (global) {
  'use strict';
  const core = global.React;
  if (!core || !global.ReactDOM) throw new Error('Bundled React runtime missing');
  let current = null;
  const wrapped = new WeakMap();
  function depsSame(a, b) {
    return Array.isArray(a) && Array.isArray(b) &&
      a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  }
  function slot() {
    if (!current) throw new Error('Hooks must be called inside a React function component');
    const self = current;
    const index = self._hookCursor++;
    if (!self._hookSlots[index]) self._hookSlots[index] = {};
    return [self, self._hookSlots[index]];
  }
  function useState(initial) {
    const [self, s] = slot();
    if (!Object.prototype.hasOwnProperty.call(s, 'value')) {
      s.value = typeof initial === 'function' ? initial() : initial;
    }
    if (!s.set) s.set = (next) => {
      const value = typeof next === 'function' ? next(s.value) : next;
      if (Object.is(value, s.value)) return;
      s.value = value;
      if (self._mounted) self.setState((p) => ({ _hookVersion: (p._hookVersion || 0) + 1 }));
    };
    return [s.value, s.set];
  }
  function useRef(initial) {
    const [, s] = slot();
    if (!s.ref) s.ref = { current: initial };
    return s.ref;
  }
  function useMemo(fn, deps) {
    const [, s] = slot();
    if (!s.hasValue || !depsSame(deps, s.deps)) {
      s.value = fn(); s.deps = deps; s.hasValue = true;
    }
    return s.value;
  }
  function useCallback(fn, deps) { return useMemo(() => fn, deps); }
  function useEffect(fn, deps) {
    const [self, s] = slot();
    if (!s.hasRun || !depsSame(deps, s.deps)) {
      self._pendingEffects.push({ s, fn, deps });
    }
  }
  function wrap(fn) {
    if (wrapped.has(fn)) return wrapped.get(fn);
    class FunctionalWrapper extends core.Component {
      constructor(props) {
        super(props);
        this.state = { _hookVersion: 0 };
        this._hookSlots = [];
        this._hookCursor = 0;
        this._pendingEffects = [];
        this._mounted = false;
      }
      _flushEffects() {
        const effects = this._pendingEffects;
        this._pendingEffects = [];
        for (const { s, fn, deps } of effects) {
          if (typeof s.cleanup === 'function') s.cleanup();
          s.cleanup = fn() || null;
          s.deps = deps;
          s.hasRun = true;
        }
      }
      componentDidMount() { this._mounted = true; this._flushEffects(); }
      componentDidUpdate() { this._flushEffects(); }
      componentWillUnmount() {
        this._mounted = false;
        for (const s of this._hookSlots) if (s && typeof s.cleanup === 'function') s.cleanup();
      }
      render() {
        this._hookCursor = 0;
        this._pendingEffects = [];
        const previous = current;
        current = this;
        try { return fn(this.props); }
        finally { current = previous; }
      }
    }
    FunctionalWrapper.displayName = fn.displayName || fn.name || 'ILSComponent';
    wrapped.set(fn, FunctionalWrapper);
    return FunctionalWrapper;
  }
  function createElement(type, ...rest) {
    if (typeof type === 'function' && !(type.prototype && type.prototype.isReactComponent)) {
      type = wrap(type);
    }
    return core.createElement(type, ...rest);
  }
  function Fragment(props) { return createElement('span', { style: { display: 'contents' } }, props.children); }
  function StrictMode(props) { return createElement('span', { style: { display: 'contents' } }, props.children); }
  const facade = Object.assign({}, core, {
    createElement, Fragment, StrictMode, useState, useRef, useMemo, useCallback, useEffect
  });
  global.ILSReactCompat = facade;
})(window);
