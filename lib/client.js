window.__ModuleLoader__.load({
  id: "@JinzhaoTian/git-worktree-graph",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  default: () => client_default
});
module.exports = __toCommonJS(client_exports);
var React2 = __toESM(require("react"), 1);

// src/ui/worktree.ts
var React = __toESM(require("react"), 1);

// node_modules/clsx/dist/clsx.mjs
function r(e) {
  var t, f, n = "";
  if ("string" == typeof e || "number" == typeof e) n += e;
  else if ("object" == typeof e) if (Array.isArray(e)) {
    var o = e.length;
    for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
  } else for (f in e) e[f] && (n && (n += " "), n += f);
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
  return n;
}
var clsx_default = clsx;

// src/ui/worktree.ts
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/ui/worktree.module.css
var worktree_default = {
  "dsh-gw": "worktree_dsh-gw",
  "dsh-gw-tbar": "worktree_dsh-gw-tbar",
  "dsh-gw-icons": "worktree_dsh-gw-icons",
  "dsh-gw-iconbtn": "worktree_dsh-gw-iconbtn",
  "dsh-gw-wt": "worktree_dsh-gw-wt",
  "dsh-gw-wt-placeholder": "worktree_dsh-gw-wt-placeholder",
  "dsh-gw-dot": "worktree_dsh-gw-dot",
  "dsh-gw-msg": "worktree_dsh-gw-msg",
  "dsh-gw-error": "worktree_dsh-gw-error",
  "dsh-gw-empty": "worktree_dsh-gw-empty",
  "dsh-gw-scroll": "worktree_dsh-gw-scroll",
  "dsh-gw-grid": "worktree_dsh-gw-grid",
  "dsh-gw-row": "worktree_dsh-gw-row",
  "dsh-gw-row-open": "worktree_dsh-gw-row-open",
  "dsh-gw-cell": "worktree_dsh-gw-cell",
  "dsh-gw-cell-sec": "worktree_dsh-gw-cell-sec",
  "dsh-gw-gcell": "worktree_dsh-gw-gcell",
  "dsh-gw-subj": "worktree_dsh-gw-subj",
  "dsh-gw-subjtext": "worktree_dsh-gw-subjtext",
  "dsh-gw-ref": "worktree_dsh-gw-ref",
  "dsh-gw-ref-branch": "worktree_dsh-gw-ref-branch",
  "dsh-gw-ref-remote": "worktree_dsh-gw-ref-remote",
  "dsh-gw-ref-icon": "worktree_dsh-gw-ref-icon",
  "dsh-gw-ref-name": "worktree_dsh-gw-ref-name",
  "dsh-gw-ref-remote-name": "worktree_dsh-gw-ref-remote-name",
  "dsh-gw-ref-current": "worktree_dsh-gw-ref-current",
  "dsh-gw-ref-tag": "worktree_dsh-gw-ref-tag",
  "dsh-gw-ref-stash": "worktree_dsh-gw-ref-stash",
  "dsh-gw-ref-worktree": "worktree_dsh-gw-ref-worktree",
  "dsh-gw-ref-worktree-label": "worktree_dsh-gw-ref-worktree-label",
  "dsh-gw-ref-worktree-held": "worktree_dsh-gw-ref-worktree-held",
  "dsh-gw-ref-worktree-icon": "worktree_dsh-gw-ref-worktree-icon",
  "dsh-gw-ref-worktree-name": "worktree_dsh-gw-ref-worktree-name",
  "dsh-gw-ref-worktree-remote": "worktree_dsh-gw-ref-worktree-remote",
  "dsh-gw-uncommitted": "worktree_dsh-gw-uncommitted",
  "dsh-gw-row-head": "worktree_dsh-gw-row-head",
  "dsh-gw-detailrow": "worktree_dsh-gw-detailrow",
  "dsh-gw-rail": "worktree_dsh-gw-rail",
  "dsh-gw-rail-line": "worktree_dsh-gw-rail-line",
  "dsh-gw-rail-turn": "worktree_dsh-gw-rail-turn",
  "dsh-gw-detailbody": "worktree_dsh-gw-detailbody",
  "dsh-gw-detail": "worktree_dsh-gw-detail",
  "dsh-gw-detail-side": "worktree_dsh-gw-detail-side",
  "dsh-gw-detail-primary": "worktree_dsh-gw-detail-primary",
  "dsh-gw-detail-summary": "worktree_dsh-gw-detail-summary",
  "dsh-gw-detail-metadata": "worktree_dsh-gw-detail-metadata",
  "dsh-gw-detail-files": "worktree_dsh-gw-detail-files",
  "dsh-gw-detail-grip": "worktree_dsh-gw-detail-grip",
  "dsh-gw-detail-narrow": "worktree_dsh-gw-detail-narrow",
  "dsh-gw-detail-single": "worktree_dsh-gw-detail-single",
  "dsh-gw-kv": "worktree_dsh-gw-kv",
  "dsh-gw-k": "worktree_dsh-gw-k",
  "dsh-gw-v": "worktree_dsh-gw-v",
  "dsh-gw-mono": "worktree_dsh-gw-mono",
  "dsh-gw-body": "worktree_dsh-gw-body",
  "dsh-gw-legacy": "worktree_dsh-gw-legacy",
  "dsh-gw-stat": "worktree_dsh-gw-stat",
  "dsh-gw-add": "worktree_dsh-gw-add",
  "dsh-gw-del": "worktree_dsh-gw-del",
  "dsh-gw-ftree": "worktree_dsh-gw-ftree",
  "dsh-gw-frow": "worktree_dsh-gw-frow",
  "dsh-gw-frow-folder": "worktree_dsh-gw-frow-folder",
  "dsh-gw-frow-file": "worktree_dsh-gw-frow-file",
  "dsh-gw-frow-binary": "worktree_dsh-gw-frow-binary",
  "dsh-gw-fname": "worktree_dsh-gw-fname",
  "dsh-gw-file-icon": "worktree_dsh-gw-file-icon",
  "dsh-gw-folder-icon": "worktree_dsh-gw-folder-icon",
  "dsh-gw-fstat": "worktree_dsh-gw-fstat",
  "dsh-gw-more": "worktree_dsh-gw-more",
  "dsh-gw-modal": "worktree_dsh-gw-modal",
  "dsh-gw-warn": "worktree_dsh-gw-warn",
  "dsh-gw-actions": "worktree_dsh-gw-actions",
  "dsh-gw-danger": "worktree_dsh-gw-danger",
  "dsh-gw-diffpane": "worktree_dsh-gw-diffpane",
  "dsh-gw-diffwrap": "worktree_dsh-gw-diffwrap",
  "dsh-gw-difflines": "worktree_dsh-gw-difflines",
  "dsh-gw-diffhead": "worktree_dsh-gw-diffhead",
  "dsh-gw-difficon": "worktree_dsh-gw-difficon",
  "dsh-gw-difftitle": "worktree_dsh-gw-difftitle",
  "dsh-gw-diffspace": "worktree_dsh-gw-diffspace",
  "dsh-gw-diffpath": "worktree_dsh-gw-diffpath",
  "dsh-gw-diffcounts": "worktree_dsh-gw-diffcounts",
  "dsh-gw-diffstatus": "worktree_dsh-gw-diffstatus",
  "dsh-gw-diffoid": "worktree_dsh-gw-diffoid",
  "dsh-gw-difftools": "worktree_dsh-gw-difftools",
  "dsh-gw-diffbody": "worktree_dsh-gw-diffbody",
  "dsh-gw-dgap": "worktree_dsh-gw-dgap",
  "dsh-gw-dgapicon": "worktree_dsh-gw-dgapicon",
  "dsh-gw-hunk": "worktree_dsh-gw-hunk",
  "dsh-gw-dline": "worktree_dsh-gw-dline",
  "dsh-gw-dnum": "worktree_dsh-gw-dnum",
  "dsh-gw-dline-add": "worktree_dsh-gw-dline-add",
  "dsh-gw-dsline-add": "worktree_dsh-gw-dsline-add",
  "dsh-gw-dline-del": "worktree_dsh-gw-dline-del",
  "dsh-gw-dsline-del": "worktree_dsh-gw-dsline-del",
  "dsh-gw-dtext": "worktree_dsh-gw-dtext",
  "dsh-gw-dsrow": "worktree_dsh-gw-dsrow",
  "dsh-gw-dscol": "worktree_dsh-gw-dscol",
  "dsh-gw-dsempty": "worktree_dsh-gw-dsempty",
  "dsh-gw-dsline": "worktree_dsh-gw-dsline",
  "dsh-gw-dsnumcol": "worktree_dsh-gw-dsnumcol",
  "dsh-gw-dshatch": "worktree_dsh-gw-dshatch",
  "dsh-gw-dtext-add": "worktree_dsh-gw-dtext-add",
  "dsh-gw-dtext-del": "worktree_dsh-gw-dtext-del"
};

// src/ui/worktree.ts
var CSS_MODULE_TEXT = "/* src/ui/worktree.module.css */\n.worktree_dsh-gw {\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  min-height: 0;\n  font-size: var(--dsh-content-font-size-secondary, 13px);\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-base);\n}\n.worktree_dsh-gw * {\n  box-sizing: border-box;\n}\n.worktree_dsh-gw-tbar {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  flex: 0 0 38px;\n  width: 100%;\n  min-width: 0;\n  height: 38px;\n  padding: 0 6px 0 16px;\n  border-bottom: .5px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-base);\n  white-space: nowrap;\n}\n.worktree_dsh-gw-icons {\n  display: inline-flex;\n  flex: 0 0 auto;\n  align-items: center;\n  gap: 2px;\n}\n.worktree_dsh-gw-iconbtn {\n  display: inline-flex;\n  flex: 0 0 auto;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  padding: 6px;\n  border: 0;\n  border-radius: var(--dsw-radius-sm);\n  background: none;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n  line-height: 1;\n}\n.worktree_dsh-gw-iconbtn svg {\n  width: 15px;\n  height: 15px;\n}\n.worktree_dsh-gw-iconbtn:hover,\n.worktree_dsh-gw-iconbtn[aria-pressed=true] {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n.worktree_dsh-gw-iconbtn:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 1px;\n}\n.worktree_dsh-gw-wt {\n  margin-right: 12px;\n}\n.worktree_dsh-gw-wt-placeholder {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  color: var(--dsw-alias-label-secondary);\n}\n.worktree_dsh-gw-dot {\n  flex: 0 0 auto;\n  width: 6px;\n  height: 6px;\n  margin-left: 6px;\n  border-radius: 50%;\n  corner-shape: round;\n  background: var(--dsw-alias-state-warn-primary);\n}\n.worktree_dsh-gw-msg {\n  padding: 5px 10px;\n  color: var(--dsw-alias-label-secondary);\n  border-bottom: .5px solid var(--dsw-alias-border-l1);\n}\n.worktree_dsh-gw-error {\n  margin: 8px 10px;\n  padding: 6px 8px;\n  border: 1px solid var(--dsw-alias-state-error-primary);\n  border-radius: var(--dsw-radius-sm);\n  color: var(--dsw-alias-state-error-primary);\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n.worktree_dsh-gw-empty {\n  padding: 16px 10px;\n  color: var(--dsw-alias-label-secondary);\n  text-align: center;\n}\n.worktree_dsh-gw-scroll {\n  flex: 1 1 auto;\n  min-height: 0;\n  margin-right: 2px;\n  padding: 8px 0 8px 8px;\n  overflow: auto;\n  scrollbar-gutter: stable;\n}\n.worktree_dsh-gw-grid {\n  display: flex;\n  flex-direction: column;\n  min-width: 100%;\n}\n.worktree_dsh-gw-row {\n  display: grid;\n  grid-template-columns: var(--dsh-gw-cols);\n  align-items: center;\n  height: var(--dsh-gw-row-height);\n  overflow: hidden;\n  border-radius: var(--dsw-radius-md);\n  cursor: pointer;\n  outline: none;\n}\n.worktree_dsh-gw-row:hover,\n.worktree_dsh-gw-row-open {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.worktree_dsh-gw-row-open {\n  border-radius: var(--dsw-radius-md) var(--dsw-radius-md) 0 0;\n}\n.worktree_dsh-gw-row:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: -2px;\n}\n.worktree_dsh-gw-cell {\n  display: flex;\n  align-items: center;\n  min-width: 0;\n  padding: 0 8px;\n}\n.worktree_dsh-gw-cell-sec {\n  color: var(--dsw-alias-label-secondary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.worktree_dsh-gw-gcell {\n  display: flex;\n  align-self: stretch;\n  overflow: hidden;\n}\n.worktree_dsh-gw-gcell svg {\n  display: block;\n  flex: 0 0 auto;\n}\n.worktree_dsh-gw-subj {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  width: 100%;\n}\n.worktree_dsh-gw-subjtext {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.worktree_dsh-gw-ref {\n  flex: 0 0 auto;\n  max-width: 200px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  padding: 0 5px;\n  border-radius: var(--dsw-radius-xs);\n  font-size: 11px;\n  line-height: 16px;\n  border: .5px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-secondary);\n}\n.worktree_dsh-gw-ref-branch,\n.worktree_dsh-gw-ref-remote {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 0 5px 0 0;\n  border-color: color-mix(in srgb, var(--dsh-gw-ref-color) 42%, var(--dsw-alias-border-l2));\n  background: color-mix(in srgb, var(--dsh-gw-ref-color) 8%, var(--dsw-alias-bg-layer-2));\n  color: var(--dsh-gw-ref-color);\n}\n.worktree_dsh-gw-ref-remote {\n  border-style: dashed;\n}\n.worktree_dsh-gw-ref-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  align-self: stretch;\n  width: 18px;\n  min-width: 18px;\n  min-height: 16px;\n  border-radius: var(--dsw-radius-xs) 0 0 var(--dsw-radius-xs);\n  background: var(--dsh-gw-ref-color);\n  color: var(--dsw-alias-label-primary-foreground);\n}\n.worktree_dsh-gw-ref-icon svg {\n  display: block;\n}\n.worktree_dsh-gw-ref-name {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.worktree_dsh-gw-ref-remote-name {\n  color: var(--dsw-alias-label-secondary);\n  font-style: italic;\n}\n.worktree_dsh-gw-ref-current {\n  border-color: color-mix(in srgb, var(--dsh-gw-ref-color) 68%, var(--dsw-alias-border-l2));\n  font-weight: 600;\n}\n.worktree_dsh-gw-ref-tag {\n  color: var(--dsw-alias-state-success-primary);\n}\n.worktree_dsh-gw-ref-stash {\n  color: var(--dsw-alias-state-warn-primary);\n}\n.worktree_dsh-gw-ref-worktree {\n  display: inline-flex;\n  align-items: stretch;\n  gap: 0;\n  padding: 0;\n  border: 1px solid var(--dsw-alias-label-primary);\n  border-radius: var(--dsw-radius-xs);\n  overflow: hidden;\n  background: none;\n  font-size: 11px;\n  line-height: 18px;\n}\n.worktree_dsh-gw-ref-worktree-label {\n  display: inline-flex;\n  align-items: center;\n  padding: 0 7px;\n  background: var(--dsw-alias-label-primary);\n  color: var(--dsw-alias-bg-base);\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 18px;\n}\n.worktree_dsh-gw-ref-worktree-held {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 0 7px 0 0;\n  background: color-mix(in srgb, var(--dsh-gw-ref-color) 8%, var(--dsw-alias-bg-layer-2));\n  color: var(--dsw-alias-label-primary);\n  line-height: 18px;\n}\n.worktree_dsh-gw-ref-worktree-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  align-self: stretch;\n  width: 18px;\n  min-width: 18px;\n  background: var(--dsh-gw-ref-color);\n  color: var(--dsw-alias-label-primary-foreground);\n}\n.worktree_dsh-gw-ref-worktree-icon svg {\n  display: block;\n}\n.worktree_dsh-gw-ref-worktree-name {\n  display: inline-flex;\n  align-items: center;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.worktree_dsh-gw-ref-worktree-remote {\n  color: var(--dsw-alias-label-secondary);\n  font-style: italic;\n}\n.worktree_dsh-gw-uncommitted {\n  font-weight: 600;\n}\n.worktree_dsh-gw-row-head {\n  font-weight: 600;\n}\n.worktree_dsh-gw-row-head .worktree_dsh-gw-ref {\n  font-weight: 400;\n}\n.worktree_dsh-gw-detailrow {\n  display: flex;\n  align-items: stretch;\n  overflow: hidden;\n  border-radius: 0 0 var(--dsw-radius-md) var(--dsw-radius-md);\n  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 70%, var(--dsw-alias-bg-layer-1));\n  box-shadow: inset 0 1px 0 var(--dsw-alias-border-l1);\n}\n.worktree_dsh-gw-rail {\n  position: relative;\n  flex: 0 0 auto;\n  align-self: stretch;\n  overflow: hidden;\n}\n.worktree_dsh-gw-rail-line {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  border-radius: 1px;\n}\n.worktree_dsh-gw-rail-turn {\n  position: absolute;\n  display: block;\n  overflow: visible;\n}\n.worktree_dsh-gw-detailbody {\n  flex: 1 1 auto;\n  min-width: 0;\n  padding: 0 8px 10px 0;\n}\n.worktree_dsh-gw-detail {\n  --dsh-gw-detail-grip: 8px;\n  display: flex;\n  align-items: stretch;\n  width: 100%;\n  max-height: var(--dsh-gw-detail-max);\n  overflow: hidden;\n  background: transparent;\n}\n.worktree_dsh-gw-detail-side {\n  display: flex;\n  flex: 1 1 0;\n  flex-direction: column;\n  min-width: 0;\n  min-height: 0;\n  overflow: hidden;\n}\n.worktree_dsh-gw-detail-primary {\n  flex: 0 0 auto;\n  min-width: 0;\n  padding: 8px 10px 0;\n}\n.worktree_dsh-gw-detail-summary {\n  flex: 0 0 auto;\n  min-width: 0;\n  padding: 8px 10px 0;\n}\n.worktree_dsh-gw-detail-metadata {\n  flex: 1 1 auto;\n  min-width: 0;\n  min-height: 0;\n  padding: 5px 10px 8px;\n  overflow: auto;\n}\n.worktree_dsh-gw-detail-files {\n  flex: 1 1 auto;\n  min-width: 0;\n  min-height: 0;\n  padding: 0 10px 8px;\n  overflow: auto;\n}\n.worktree_dsh-gw-detail-grip {\n  flex: 0 0 auto;\n  position: relative;\n  align-self: stretch;\n  width: var(--dsh-gw-detail-grip);\n  min-height: 0;\n  cursor: col-resize;\n  touch-action: none;\n}\n.worktree_dsh-gw-detail-grip::before {\n  content: \"\";\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 50%;\n  width: 1px;\n  margin-left: -.5px;\n  background: var(--dsw-alias-border-l1);\n}\n.worktree_dsh-gw-detail-grip:hover::before,\n.worktree_dsh-gw-detail-grip:focus-visible::before,\n.worktree_dsh-gw-detail-grip[data-dragging]::before {\n  width: 2px;\n  margin-left: -1px;\n  background: var(--dsw-alias-brand-primary);\n}\n.worktree_dsh-gw-detail-grip:focus-visible {\n  outline: none;\n}\n.worktree_dsh-gw-detail-narrow {\n  flex-direction: column;\n  overflow: auto;\n}\n.worktree_dsh-gw-detail-narrow .worktree_dsh-gw-detail-side {\n  flex: 0 0 auto;\n  overflow: visible;\n}\n.worktree_dsh-gw-detail-narrow .worktree_dsh-gw-detail-primary,\n.worktree_dsh-gw-detail-narrow .worktree_dsh-gw-detail-summary,\n.worktree_dsh-gw-detail-narrow .worktree_dsh-gw-detail-metadata,\n.worktree_dsh-gw-detail-narrow .worktree_dsh-gw-detail-files {\n  flex: 0 0 auto;\n  overflow: visible;\n}\n.worktree_dsh-gw-detail-narrow .worktree_dsh-gw-detail-metadata {\n  padding-top: 5px;\n  border-bottom: .5px solid var(--dsw-alias-border-l1);\n}\n.worktree_dsh-gw-detail-narrow.worktree_dsh-gw-detail-single .worktree_dsh-gw-detail-metadata {\n  border-bottom: 0;\n}\n.worktree_dsh-gw-kv {\n  display: grid;\n  grid-template-columns: 78px minmax(0, 1fr);\n  gap: 2px 8px;\n  font-size: var(--dsh-content-font-size-secondary, 13px);\n  line-height: 1.5;\n}\n.worktree_dsh-gw-k {\n  color: var(--dsw-alias-label-secondary);\n}\n.worktree_dsh-gw-v {\n  min-width: 0;\n  overflow-wrap: anywhere;\n}\n.worktree_dsh-gw-mono {\n  font-family:\n    ui-monospace,\n    SFMono-Regular,\n    Menlo,\n    Consolas,\n    monospace;\n}\n.worktree_dsh-gw-body {\n  margin-top: 8px;\n  padding-top: 8px;\n  border-top: .5px solid var(--dsw-alias-border-l1);\n  white-space: pre-wrap;\n  color: var(--dsw-alias-label-secondary);\n}\n.worktree_dsh-gw-legacy {\n  margin: 0;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  font:\n    11px/1.45 ui-monospace,\n    SFMono-Regular,\n    Menlo,\n    Consolas,\n    monospace;\n  color: var(--dsw-alias-label-secondary);\n}\n.worktree_dsh-gw-stat {\n  color: var(--dsw-alias-label-secondary);\n  font-size: var(--dsh-content-font-size-secondary, 13px);\n  line-height: 1.5;\n}\n.worktree_dsh-gw-add {\n  color: var(--dsw-alias-state-success-primary);\n}\n.worktree_dsh-gw-del {\n  color: var(--dsw-alias-state-error-primary);\n}\n.worktree_dsh-gw-ftree {\n  display: flex;\n  flex-direction: column;\n}\n.worktree_dsh-gw-frow {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  width: calc(100% - var(--dsh-gw-indent, 0px));\n  min-height: 30px;\n  min-width: 0;\n  margin-left: var(--dsh-gw-indent, 0px);\n  padding: 5px 10px;\n  border: 0;\n  border-radius: var(--dsw-radius-md);\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  text-align: left;\n}\n.worktree_dsh-gw-frow-folder {\n  cursor: pointer;\n}\n.worktree_dsh-gw-frow-folder:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.worktree_dsh-gw-frow-folder:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: -2px;\n}\n.worktree_dsh-gw-frow-file {\n  cursor: pointer;\n}\n.worktree_dsh-gw-frow-file:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.worktree_dsh-gw-frow-file:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: -2px;\n}\n.worktree_dsh-gw-frow-binary .worktree_dsh-gw-fname {\n  font-style: italic;\n}\n.worktree_dsh-gw-frow svg {\n  display: block;\n  flex: 0 0 auto;\n}\n.worktree_dsh-gw-file-icon,\n.worktree_dsh-gw-folder-icon {\n  width: 16px;\n  height: 16px;\n  flex-basis: 16px;\n}\n.worktree_dsh-gw-folder-icon {\n  color: var(--dsw-alias-label-tertiary);\n}\n.worktree_dsh-gw-fname {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.worktree_dsh-gw-fstat {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n  margin-left: auto;\n  padding-left: 8px;\n  flex: 0 0 auto;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n  line-height: 18px;\n  font-variant-numeric: tabular-nums;\n}\n.worktree_dsh-gw-fstat .worktree_dsh-gw-stat {\n  margin: 0;\n  font-size: inherit;\n  line-height: inherit;\n}\n.worktree_dsh-gw-more {\n  padding: 8px;\n  text-align: center;\n}\n.worktree_dsh-gw-modal {\n  width: min(420px, 100%);\n}\n.worktree_dsh-gw-modal p {\n  margin: 4px 0;\n  font-size: var(--dsh-content-font-size-secondary, 13px);\n  line-height: 1.5;\n  color: var(--dsw-alias-label-secondary);\n  overflow-wrap: anywhere;\n}\n.worktree_dsh-gw-modal ol {\n  max-height: 140px;\n  overflow: auto;\n  margin: 6px 0;\n  padding-left: 20px;\n  font-size: var(--dsh-content-font-size-secondary, 13px);\n  line-height: 1.5;\n}\n.worktree_dsh-gw-warn {\n  color: var(--dsw-alias-state-warn-primary);\n}\n.worktree_dsh-gw-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n}\n.worktree_dsh-gw-danger {\n  border-color: var(--dsw-alias-state-error-primary);\n  color: var(--dsw-alias-state-error-primary);\n}\n.worktree_dsh-gw-diffpane {\n  --dsh-gw-gutter: 54px;\n  display: flex;\n  flex: 1 1 auto;\n  flex-direction: column;\n  min-height: 0;\n  font-size: var(--dsh-content-font-size-secondary, 13px);\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-bg-base);\n}\n.worktree_dsh-gw-diffpane * {\n  box-sizing: border-box;\n}\n.worktree_dsh-gw-diffwrap {\n  display: flex;\n  flex: 1 1 auto;\n  flex-direction: column;\n  min-height: 0;\n}\n.worktree_dsh-gw-difflines {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow: auto;\n}\n.worktree_dsh-gw-diffhead {\n  display: flex;\n  flex: 0 0 38px;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  height: 38px;\n  padding: 0 6px 0 12px;\n  border-bottom: .5px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-base);\n  white-space: nowrap;\n}\n.worktree_dsh-gw-difficon {\n  display: block;\n  flex: 0 0 auto;\n  width: 16px;\n  height: 16px;\n}\n.worktree_dsh-gw-difftitle {\n  display: flex;\n  flex: 0 1 auto;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n}\n.worktree_dsh-gw-diffspace {\n  flex: 1 1 auto;\n  min-width: 0;\n}\n.worktree_dsh-gw-diffpath {\n  min-width: 0;\n}\n.worktree_dsh-gw-diffcounts {\n  display: inline-flex;\n  flex: 0 0 auto;\n  align-items: center;\n  gap: 7px;\n  font-size: 12px;\n  font-variant-numeric: tabular-nums;\n}\n.worktree_dsh-gw-diffstatus {\n  flex: 0 0 auto;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n}\n.worktree_dsh-gw-diffoid {\n  flex: 0 0 auto;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n}\n.worktree_dsh-gw-difftools {\n  display: inline-flex;\n  flex: 0 0 auto;\n  align-items: center;\n  gap: 2px;\n}\n.worktree_dsh-gw-iconbtn:disabled {\n  cursor: default;\n  opacity: .45;\n}\n.worktree_dsh-gw-iconbtn:disabled:hover {\n  background: none;\n  color: var(--dsw-alias-label-secondary);\n}\n.worktree_dsh-gw-diffbody {\n  width: max-content;\n  min-width: 100%;\n  padding-bottom: 20px;\n  font:\n    12px/1.6 ui-monospace,\n    SFMono-Regular,\n    Menlo,\n    Consolas,\n    monospace;\n}\n.worktree_dsh-gw-diffpane[data-wrap=true] .worktree_dsh-gw-diffbody {\n  width: auto;\n}\n.worktree_dsh-gw-dgap {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin: 4px 8px;\n  padding: 0 8px;\n  border-radius: var(--dsw-radius-sm);\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 22px;\n}\n.worktree_dsh-gw-dgapicon {\n  flex: 0 0 auto;\n}\n.worktree_dsh-gw-hunk {\n  margin-top: 2px;\n}\n.worktree_dsh-gw-dline {\n  display: flex;\n  align-items: stretch;\n  min-height: 1.6em;\n  background: var(--dsw-alias-bg-base);\n}\n.worktree_dsh-gw-dnum {\n  position: sticky;\n  left: 0;\n  z-index: 1;\n  flex: 0 0 auto;\n  width: var(--dsh-gw-gutter);\n  padding: 0 9px 0 8px;\n  border-right: 4px solid var(--dsw-alias-bg-base);\n  background-color: var(--dsw-alias-bg-base);\n  background-clip: padding-box;\n  color: var(--dsw-alias-label-tertiary);\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n  user-select: none;\n}\n.worktree_dsh-gw-dnum::before {\n  content: \"\";\n  position: absolute;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 4px;\n}\n.worktree_dsh-gw-dline-add .worktree_dsh-gw-dnum::before,\n.worktree_dsh-gw-dsline-add .worktree_dsh-gw-dnum::before {\n  background: var(--dsw-alias-state-success-primary);\n}\n.worktree_dsh-gw-dline-del .worktree_dsh-gw-dnum::before,\n.worktree_dsh-gw-dsline-del .worktree_dsh-gw-dnum::before {\n  background: var(--dsw-alias-state-error-primary);\n}\n.worktree_dsh-gw-dline-add .worktree_dsh-gw-dnum,\n.worktree_dsh-gw-dsline-add .worktree_dsh-gw-dnum {\n  background-color: #edf7ed;\n  color: var(--dsw-alias-state-success-primary);\n}\n.worktree_dsh-gw-dline-del .worktree_dsh-gw-dnum,\n.worktree_dsh-gw-dsline-del .worktree_dsh-gw-dnum {\n  background-color: #fdece9;\n  color: var(--dsw-alias-state-error-primary);\n}\nbody[data-ds-dark-theme] .worktree_dsh-gw-dline-add .worktree_dsh-gw-dnum,\nbody[data-ds-dark-theme] .worktree_dsh-gw-dsline-add .worktree_dsh-gw-dnum {\n  background-color: #132017;\n}\nbody[data-ds-dark-theme] .worktree_dsh-gw-dline-del .worktree_dsh-gw-dnum,\nbody[data-ds-dark-theme] .worktree_dsh-gw-dsline-del .worktree_dsh-gw-dnum {\n  background-color: #28130e;\n}\n.worktree_dsh-gw-dtext {\n  flex: 1 1 auto;\n  padding: 0 14px 0 11px;\n  white-space: pre;\n}\n.worktree_dsh-gw-diffpane[data-wrap=true] .worktree_dsh-gw-dtext {\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}\n.worktree_dsh-gw-diffpane[data-mode=split] .worktree_dsh-gw-diffbody {\n  width: auto;\n  padding-bottom: 20px;\n}\n.worktree_dsh-gw-dsrow {\n  display: flex;\n  align-items: stretch;\n}\n.worktree_dsh-gw-dscol,\n.worktree_dsh-gw-dsempty {\n  display: flex;\n  flex: 1 1 50%;\n  min-width: 0;\n  border-right: 4px solid var(--dsw-alias-bg-base);\n  background: var(--dsw-alias-bg-base);\n  background-clip: padding-box;\n}\n.worktree_dsh-gw-dscol {\n  flex-direction: column;\n}\n.worktree_dsh-gw-dscol:last-child,\n.worktree_dsh-gw-dsempty:last-child {\n  border-right: 0;\n}\n.worktree_dsh-gw-dsline {\n  display: flex;\n  min-width: 0;\n}\n.worktree_dsh-gw-dsline .worktree_dsh-gw-dnum,\n.worktree_dsh-gw-dscol .worktree_dsh-gw-dnum {\n  position: relative;\n}\n.worktree_dsh-gw-dsnumcol {\n  flex: 0 0 auto;\n  width: var(--dsh-gw-gutter);\n  border-right: 4px solid var(--dsw-alias-bg-base);\n  background-color: var(--dsw-alias-bg-base);\n  background-clip: padding-box;\n}\n.worktree_dsh-gw-dshatch {\n  flex: 1 1 auto;\n  min-width: 0;\n  background:\n    repeating-linear-gradient(\n      45deg,\n      transparent 0 3px,\n      color-mix(in srgb, var(--dsw-alias-label-tertiary) 16%, transparent) 3px 6px),\n    var(--dsw-alias-bg-base);\n}\n.worktree_dsh-gw-dtext-add {\n  background: #e6f4e7;\n}\n.worktree_dsh-gw-dtext-del {\n  background: #fce6e2;\n}\nbody[data-ds-dark-theme] .worktree_dsh-gw-dtext-add {\n  background: #1f3124;\n}\nbody[data-ds-dark-theme] .worktree_dsh-gw-dtext-del {\n  background: #3b1f1b;\n}\n";
var h = (type, props, ...children) => {
  const className = props?.className;
  const resolved = typeof className === "string" ? { ...props, className: clsx_default(className.split(/\s+/).map((name) => worktree_default[name] || name)) } : props;
  return React.createElement(type, resolved, ...children);
};
var WORKTREE_TAB_TITLE = "Git Worktree Graph";
var FILE_DIFF_KIND = "git-worktree-graph-file-diff";
var FILE_DIFF_TITLE = "File diff";
var PAGE = 300;
var ROW = 30;
var COL = 14;
var PAD = 10;
var MARGIN = 8;
var CROSS_NEAR = 7;
var CROSS_FAR = ROW - 7;
var COLUMN_GUTTER = 24;
var DESCRIPTION_MIN = 280;
var DATE_MIN = 116;
var AUTHOR_MIN = 112;
var DATE_MAX = 164;
var AUTHOR_MAX = 164;
var DETAIL_TWO_COLUMN_MIN = 620;
var DETAIL_MAX_SHARE = 0.45;
var DETAIL_MAX_CEILING = 420;
var DETAIL_MAX_FLOOR = ROW * 6;
var DETAIL_SHARE_MIN = 0.2;
var DETAIL_SHARE_MAX = 0.8;
var DETAIL_SHARE_DEFAULT = 0.5;
var detailShare = DETAIL_SHARE_DEFAULT;
var RESOLVE_ATTEMPTS = 4;
var RESOLVE_BACKOFF_MS = 300;
var LANE_COLORS = ["#2f8ae0", "#d0569b", "#38a169", "#d98a2b", "#8b72e0", "#0fa8ad", "#c05252", "#7a8b2f"];
var viewState = /* @__PURE__ */ new Map();
var transport = null;
function configureView(next) {
  transport = next;
}
async function api(action, params, sessionId, signal) {
  if (!transport) throw new Error("Git Worktree: no transport is configured for this view.");
  const run = transport[action];
  return run(params || {}, sessionId ?? null, signal);
}
function samePath(left, right) {
  const norm = (value) => String(value || "").replace(/[\\/]+/g, "/").replace(/\/+$/, "").toLowerCase();
  const a = norm(left);
  return a !== "" && a === norm(right);
}
function shortOid(oid) {
  return String(oid || "").slice(0, 7);
}
function fileCount(count) {
  return `${count} file${count === 1 ? "" : "s"}`;
}
function absoluteTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const hhmm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${day} ${month} ${date.getFullYear()} ${hhmm}`;
}
function relativeTime(iso) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1e3));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
function detailedTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(date);
}
function layoutLanes(nodes) {
  const waiting = [];
  const lanes = [];
  const edges = [];
  const seats = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    for (let slot = waiting.length - 1; slot >= 0; slot -= 1) {
      if (waiting[slot] === null) waiting.splice(slot, 1);
    }
    let lane = waiting.indexOf(node.id);
    if (lane < 0) lane = waiting.length;
    lanes.push(lane);
    waiting[lane] = null;
    for (const parent of node.parents || []) {
      if (!parent) continue;
      let parentLane = waiting.indexOf(parent);
      if (parentLane < 0) {
        parentLane = waiting.indexOf(null);
        if (parentLane < 0) parentLane = waiting.length;
        waiting[parentLane] = parent;
      }
      edges.push({ from: index, parent, to: nodes.length, route: [], fromLane: -1, toLane: -1, crossing: 0 });
    }
    const seat = /* @__PURE__ */ new Map();
    for (let slot = 0; slot < waiting.length; slot += 1) {
      if (waiting[slot]) seat.set(waiting[slot], slot);
    }
    seats.push(seat);
  }
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const lastSeats = seats.length > 0 ? seats[seats.length - 1] : null;
  for (const edge of edges) {
    edge.to = indexById.has(edge.parent) ? indexById.get(edge.parent) : nodes.length;
    edge.route = [];
    for (let row = edge.from + 1; row < edge.to && row < lanes.length; row += 1) {
      const seat = seats[row - 1] && seats[row - 1].get(edge.parent);
      if (seat === void 0) continue;
      const last = edge.route[edge.route.length - 1];
      if (last && last.lane === seat) continue;
      edge.route.push({ lane: seat, y: row * ROW + CROSS_NEAR });
    }
    edge.fromLane = lanes[edge.from];
    edge.toLane = edge.to < lanes.length ? lanes[edge.to] : (lastSeats ? lastSeats.get(edge.parent) : void 0) ?? edge.fromLane ?? -1;
  }
  let width = 0;
  for (const lane of lanes) width = Math.max(width, lane + 1);
  for (const edge of edges) {
    if (!Number.isInteger(edge.fromLane) || !Number.isInteger(edge.toLane)) {
      throw new Error(`git-worktree-graph: lane layout left edge ${edge.from}\u2192${edge.parent} without a column`);
    }
    width = Math.max(width, edge.fromLane + 1, edge.toLane + 1);
  }
  const departures = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    const order = departures.get(edge.from) || 0;
    departures.set(edge.from, order + 1);
    edge.crossing = (edge.from + 1) * ROW + (order % 2 === 0 ? CROSS_NEAR : CROSS_FAR);
  }
  return { lanes, edges, width: Math.max(width, 1) };
}
function strokeWidthFor(layout, index, lane) {
  let width = 1.6;
  for (const edge of layout.edges) {
    if (edge.from === index && edge.fromLane === lane) width = Math.max(width, 2.6);
  }
  return width;
}
function laneX(lane) {
  return PAD + lane * COL + COL / 2;
}
function laneY(index) {
  return index * ROW + ROW / 2;
}
function edgeRuns(edge, x1, y1, x2, y2) {
  const points = [{ x: x1, y: y1 }, { x: x1, y: edge.crossing }];
  for (const step of edge.route || []) points.push({ x: laneX(step.lane), y: step.y });
  points.push({ x: x2, y: y2 });
  return points;
}
function clipSegment(a, b, yTop, yBottom) {
  const dy = b.y - a.y;
  if (dy === 0) return a.y >= yTop && a.y <= yBottom ? [a, b] : null;
  const enter = (yTop - a.y) / dy;
  const leave = (yBottom - a.y) / dy;
  const from = Math.max(0, Math.min(enter, leave));
  const to = Math.min(1, Math.max(enter, leave));
  if (to <= from) return null;
  const at = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + dy * t });
  return [at(from), at(to)];
}
function rowPath(points, yTop, yBottom) {
  const kept = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const piece = clipSegment(points[index], points[index + 1], yTop, yBottom);
    if (!piece) continue;
    if (kept.length === 0) kept.push(piece[0]);
    kept.push(piece[1]);
  }
  if (kept.length < 2) return null;
  return kept.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y - yTop}`).join(" ");
}
function GraphCell(props) {
  const { layout, index, colors, head, above } = props;
  const children = [];
  const yTop = index * ROW;
  const yBottom = yTop + ROW;
  const to = PAD + layout.width * COL + MARGIN;
  for (const edge of layout.edges) {
    if (edge.from > index || edge.to < index) continue;
    const x1 = laneX(edge.fromLane);
    const x2 = laneX(edge.toLane);
    const y1 = laneY(edge.from);
    const y2 = laneY(edge.to);
    const stroke = colors.get(edge.fromLane);
    const width = strokeWidthFor(layout, edge.from, edge.fromLane);
    const points = x1 === x2 ? [{ x: x1, y: y1 }, { x: x1, y: y2 }] : edgeRuns(edge, x1, y1, x2, y2);
    const d = rowPath(points, yTop, yBottom);
    if (!d) continue;
    children.push(h("path", {
      key: `e${edge.from}:${edge.parent}:${index}`,
      d,
      fill: "none",
      stroke,
      strokeWidth: width,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }));
  }
  const lane = layout.lanes[index];
  if (lane !== void 0) {
    if (above) {
      children.push(h("line", {
        key: "working-tree-link",
        x1: laneX(lane),
        y1: 0,
        x2: laneX(lane),
        y2: ROW / 2,
        stroke: "var(--dsw-alias-label-secondary)",
        strokeWidth: 1.6
      }));
    }
    children.push(h("circle", {
      key: "node",
      cx: laneX(lane),
      cy: ROW / 2,
      r: head ? 4.5 : 4,
      fill: head ? "var(--dsw-alias-bg-base)" : colors.get(lane),
      stroke: head ? colors.get(lane) : "var(--dsw-alias-bg-base)",
      strokeWidth: head ? 2 : 1.6
    }));
  }
  return h(
    "div",
    { className: "dsh-gw-gcell", style: { height: ROW } },
    h("svg", { width: to, height: ROW, viewBox: `0 0 ${to} ${ROW}`, "aria-hidden": true }, children)
  );
}
function GraphRail(props) {
  const { layout, index, colors, worktree, width } = props;
  const lines = [];
  if (worktree) {
    lines.push(h("span", {
      key: "working-tree-link",
      className: "dsh-gw-rail-line",
      style: { left: `${laneX(0) - 0.8}px`, width: "1.6px", background: "var(--dsw-alias-label-secondary)" }
    }));
  }
  const bandTop = (index + 1) * ROW;
  for (const edge of layout.edges) {
    if (edge.from > index || edge.to < index + 1) continue;
    const stroke = strokeWidthFor(layout, edge.from, edge.fromLane);
    const colour = colors.get(edge.fromLane);
    const key = `rail:${edge.from}:${edge.parent}`;
    const x1 = laneX(edge.fromLane);
    const x2 = laneX(edge.toLane);
    const y1 = laneY(edge.from);
    const line = (suffix, style) => lines.push(h("span", {
      key: `${key}${suffix}`,
      className: "dsh-gw-rail-line",
      style: { background: colour, ...style }
    }));
    if (x1 === x2 || edge.crossing <= bandTop) {
      line("", { left: `${x2 - stroke / 2}px`, width: `${stroke}px` });
      continue;
    }
    const across = edge.crossing - bandTop;
    const ramp = edgeRuns(edge, x1, y1, x2, laneY(edge.to));
    const rise = ramp[2].y - ramp[1].y;
    line(":down", { left: `${x1 - stroke / 2}px`, width: `${stroke}px`, top: "0px", height: `${across}px`, bottom: "auto" });
    if (rise > 0) {
      lines.push(h("svg", {
        key: `${key}:ramp`,
        className: "dsh-gw-rail-turn",
        style: { left: "0px", top: `${across}px`, width: `${width}px`, height: `${rise}px` },
        viewBox: `0 0 ${width} ${rise}`,
        "aria-hidden": true
      }, h("line", {
        x1,
        y1: 0,
        x2,
        y2: rise,
        stroke: colour,
        strokeWidth: stroke,
        strokeLinecap: "round"
      })));
    }
    line(":onward", { left: `${x2 - stroke / 2}px`, width: `${stroke}px`, top: `${across + rise}px`, bottom: "0px" });
  }
  return h("div", { className: "dsh-gw-rail", style: { width }, "aria-hidden": true }, lines);
}
function DetailRegion(props) {
  const { rail, max, children } = props;
  return h(
    "div",
    {
      className: "dsh-gw-detailrow",
      style: { "--dsh-gw-detail-max": `${max}px` }
    },
    rail || null,
    h("div", { className: "dsh-gw-detailbody" }, children)
  );
}
function normalizeRef(ref) {
  if (typeof ref === "string") return { name: ref, kind: "branch", current: false };
  if (ref && typeof ref === "object") {
    return {
      name: String(ref.name ?? ""),
      kind: String(ref.kind ?? "branch"),
      current: Boolean(ref.current),
      // The worktree chip's second cell is the branch it absorbed, which is
      // decided before this point — normalizing must not drop it, or the chip
      // falls back to the detached form.
      holdsBranch: typeof ref.holdsBranch === "string" && ref.holdsBranch ? ref.holdsBranch : null,
      linkedRemotes: Array.isArray(ref.linkedRemotes) ? ref.linkedRemotes.map((remote) => ({
        name: String(remote.name ?? ""),
        fullName: String(remote.fullName ?? remote.name ?? "")
      })).filter((remote) => remote.name) : []
    };
  }
  return null;
}
function GraphBranchGlyph(props = {}) {
  const size = props.size || 14;
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true
    },
    h(
      "g",
      { transform: props.flipVertical ? "translate(0 16) scale(1 -1)" : void 0 },
      h("circle", { cx: 4, cy: 4, r: 2 }),
      h("circle", { cx: 4, cy: 12, r: 2 }),
      h("circle", { cx: 12, cy: 8, r: 2 }),
      h("path", { d: "M4 6v4M6 4h3a3 3 0 0 1 3 3v1" })
    )
  );
}
function BranchRefIcon(props = {}) {
  return h(GraphBranchGlyph, { ...props, flipVertical: true });
}
function DiffMarkGlyph(props = {}) {
  const size = props.size || 16;
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: props.className,
      "aria-hidden": true
    },
    h("rect", { x: 2.25, y: 2.25, width: 11.5, height: 11.5, rx: 2.5 }),
    h("path", { d: "M8 5.1v2.8M6.6 6.5h2.8" }),
    h("path", { d: "M6.6 10.2h2.8" })
  );
}
function RemoteCloudIcon({ hidden }) {
  return h(
    "svg",
    {
      width: 16,
      height: 16,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true
    },
    // Fill the same vertical span as the built-in refresh glyph. The slash
    // stays inside that span, so toggling does not change the apparent size.
    h(
      "g",
      { transform: "translate(0 -1.4) scale(1 1.18)" },
      h("path", { d: "M4.1 13h7.8a2.65 2.65 0 0 0 .32-5.28 4.35 4.35 0 0 0-8.4-1.28A3.35 3.35 0 0 0 4.1 13Z" }),
      hidden ? h("path", { d: "M2.1 2.65L13.9 13.35", strokeWidth: 1.4 }) : null
    )
  );
}
function mergeWorktreeBranch(refs, branch) {
  const worktree = refs.find((ref) => ref.kind === "worktree");
  if (!worktree || !branch) return refs;
  const held = refs.find((ref) => ref.kind === "branch" && ref.name === branch);
  if (!held) return refs;
  worktree.holdsBranch = held.name;
  worktree.linkedRemotes = held.linkedRemotes || [];
  worktree.current = held.current;
  return refs.filter((ref) => ref !== held);
}
function HeadRingGlyph(props = {}) {
  const size = props.size || 14;
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      "aria-hidden": true
    },
    h("circle", { cx: 8, cy: 8, r: 4.5 })
  );
}
function RefChip(props) {
  const ref = normalizeRef(props.gitRef);
  if (!ref || !ref.name) return null;
  const linkedRemotes = Array.isArray(ref.linkedRemotes) ? ref.linkedRemotes : [];
  const laneStyle = { "--dsh-gw-ref-color": props.laneColor };
  if (ref.kind === "worktree") {
    const held = ref.holdsBranch;
    return h(
      "span",
      {
        className: "dsh-gw-ref dsh-gw-ref-worktree",
        title: [
          held ? `worktree: ${held}` : "worktree: HEAD (no branch checked out)",
          ...linkedRemotes.map((remote) => `remote: ${remote.fullName}`)
        ].join("\n"),
        style: laneStyle
      },
      h("span", { className: "dsh-gw-ref-worktree-label" }, "worktree"),
      h(
        "span",
        { className: "dsh-gw-ref-worktree-held" },
        h(
          "span",
          { className: "dsh-gw-ref-worktree-icon" },
          held ? h(BranchRefIcon, { size: 14 }) : h(HeadRingGlyph, { size: 14 })
        ),
        h("span", { className: "dsh-gw-ref-worktree-name" }, held || "HEAD"),
        linkedRemotes.map((remote) => h("span", {
          key: remote.fullName,
          className: "dsh-gw-ref-worktree-remote"
        }, remote.name))
      )
    );
  }
  const className = clsx_default("dsh-gw-ref", `dsh-gw-ref-${ref.kind}`, ref.current && ref.kind === "branch" && "dsh-gw-ref-current");
  const branchLike = ref.kind === "branch" || ref.kind === "remote";
  return h("span", {
    className,
    title: [`${ref.kind}: ${ref.name}`, ...linkedRemotes.map((remote) => `remote: ${remote.fullName}`)].join("\n"),
    style: branchLike ? laneStyle : void 0
  }, branchLike ? h(
    React.Fragment,
    null,
    h("span", { className: "dsh-gw-ref-icon" }, h(BranchRefIcon, { size: 14 })),
    h("span", { className: "dsh-gw-ref-name" }, ref.name),
    linkedRemotes.map((remote) => h("span", {
      key: remote.fullName,
      className: "dsh-gw-ref-remote-name"
    }, remote.name))
  ) : ref.kind === "tag" ? `\u2302 ${ref.name}` : ref.name);
}
function buildFileTree(files) {
  const root = { name: "", dirs: /* @__PURE__ */ new Map(), files: [] };
  for (const file of files) {
    const parts = String(file.path || "").split("/").filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { name: parts[i], dirs: /* @__PURE__ */ new Map(), files: [] });
      node = node.dirs.get(parts[i]);
    }
    node.files.push({ name: parts[parts.length - 1] || file.path, file });
  }
  return root;
}
function FileTree(props) {
  const [collapsed, setCollapsed] = React.useState({});
  const { files, onOpen } = props;
  const root = React.useMemo(() => buildFileTree(files), [files]);
  const rows = [];
  const walk = (node, depth, prefix) => {
    const dirs = [...node.dirs.values()].sort((left, right) => left.name.localeCompare(right.name));
    for (const dir of dirs) {
      const path = prefix ? `${prefix}/${dir.name}` : dir.name;
      const isCollapsed = collapsed[path];
      const count = countFiles(dir);
      rows.push(h(
        "button",
        {
          key: `d:${path}`,
          type: "button",
          className: "dsh-gw-frow dsh-gw-frow-folder",
          style: { "--dsh-gw-indent": `${depth * 18}px` },
          "aria-expanded": !isCollapsed,
          title: path,
          onClick: () => setCollapsed((current) => ({ ...current, [path]: !current[path] }))
        },
        h(isCollapsed ? import_dsh_client_ui_primitives.IconFolderCloseRegular : import_dsh_client_ui_primitives.IconFolderOpenRegular, { className: "dsh-gw-folder-icon", size: 16 }),
        h("span", { className: "dsh-gw-fname" }, dir.name),
        h("span", { className: "dsh-gw-fstat" }, h("span", { className: "dsh-gw-stat" }, `${count}`))
      ));
      if (!isCollapsed) walk(dir, depth + 1, path);
    }
    const sorted = [...node.files].sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of sorted) {
      const file = entry.file;
      const body = [
        h(import_dsh_client_ui_primitives.FileTypeIcon, { key: "i", kind: (0, import_dsh_client_ui_primitives.classifyFileType)(entry.name), size: 16, className: "dsh-gw-file-icon" }),
        h("span", { key: "n", className: "dsh-gw-fname" }, entry.name),
        h(
          "span",
          { key: "s", className: "dsh-gw-fstat" },
          file.untracked ? h("span", { className: "dsh-gw-stat" }, "New") : [
            h("span", { key: "a", className: "dsh-gw-add" }, `+${file.add}`),
            h("span", { key: "d", className: "dsh-gw-del" }, `-${file.del}`)
          ]
        )
      ];
      const shared = {
        key: `f:${prefix}/${entry.name}`,
        className: clsx_default("dsh-gw-frow", onOpen && "dsh-gw-frow-file", file.binary && "dsh-gw-frow-binary"),
        style: { "--dsh-gw-indent": `${depth * 18}px` },
        title: onOpen ? `${file.path} \u2014 open this file's diff in its own tab` : file.path
      };
      rows.push(onOpen ? h("button", { ...shared, type: "button", onClick: () => onOpen(file) }, body) : h("div", shared, body));
    }
  };
  walk(root, 0, "");
  return h("div", { className: "dsh-gw-ftree" }, rows);
}
function countFiles(node) {
  let total = node.files.length;
  for (const dir of node.dirs.values()) total += countFiles(dir);
  return total;
}
function clampShare(share) {
  return Math.min(DETAIL_SHARE_MAX, Math.max(DETAIL_SHARE_MIN, share));
}
function roundShare(share) {
  return Math.round(share * 1e3) / 1e3;
}
function DetailGrip(props) {
  const { share, onShare } = props;
  const [dragging, setDragging] = React.useState(false);
  const draggingPointer = (event) => {
    const grip = event.currentTarget;
    return typeof grip.hasPointerCapture === "function" && grip.hasPointerCapture(event.pointerId);
  };
  const shareAt = (event) => {
    const grip = event.currentTarget;
    const grid = grip.parentElement;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const gripWidth = grip.offsetWidth || 8;
    const usable = rect.width - gripWidth;
    if (usable <= 0) return;
    onShare(clampShare((event.clientX - rect.left - gripWidth / 2) / usable));
  };
  return h("div", {
    className: "dsh-gw-detail-grip",
    role: "separator",
    "aria-orientation": "vertical",
    "aria-label": "Resize the detail columns",
    "aria-valuenow": Math.round(share * 100),
    "aria-valuemin": Math.round(DETAIL_SHARE_MIN * 100),
    "aria-valuemax": Math.round(DETAIL_SHARE_MAX * 100),
    tabIndex: 0,
    "data-dragging": dragging ? "" : void 0,
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      shareAt(event);
    },
    onPointerMove: (event) => {
      if (draggingPointer(event)) shareAt(event);
    },
    onPointerUp: (event) => {
      if (draggingPointer(event)) event.currentTarget.releasePointerCapture(event.pointerId);
      setDragging(false);
    },
    onPointerCancel: () => setDragging(false),
    onLostPointerCapture: () => setDragging(false),
    onDoubleClick: () => onShare(DETAIL_SHARE_DEFAULT),
    onKeyDown: (event) => {
      const step = event.shiftKey ? 0.05 : 0.02;
      const next = event.key === "ArrowLeft" ? share - step : event.key === "ArrowRight" ? share + step : null;
      if (next === null) return;
      event.preventDefault();
      onShare(clampShare(next));
    }
  });
}
function ExpandedDetail(props) {
  const { narrow, primary, metadata, summary, files, body, onOpenFile } = props;
  const [share, setShare] = React.useState(detailShare);
  const split = Boolean(summary) && !narrow;
  const updateShare = React.useCallback((next) => {
    detailShare = next;
    setShare(next);
  }, []);
  const flexFor = (value) => split ? { flex: `${roundShare(value)} 1 0px` } : void 0;
  return h(
    "div",
    {
      className: clsx_default("dsh-gw-detail", narrow && "dsh-gw-detail-narrow", !summary && "dsh-gw-detail-single")
    },
    h(
      "div",
      { className: "dsh-gw-detail-side", style: flexFor(share) },
      h("div", { className: "dsh-gw-detail-primary" }, primary),
      h("div", { className: "dsh-gw-detail-metadata" }, metadata, body)
    ),
    split ? h(DetailGrip, { share, onShare: updateShare }) : null,
    summary ? h(
      "div",
      { className: "dsh-gw-detail-side", style: flexFor(1 - share) },
      h(
        "div",
        { className: "dsh-gw-detail-summary" },
        h(
          "div",
          { className: "dsh-gw-stat" },
          `${fileCount(summary.changed)} changed`,
          summary.insertions > 0 ? h("span", { className: "dsh-gw-add" }, ` (+${summary.insertions})`) : null,
          summary.deletions > 0 ? h("span", { className: "dsh-gw-del" }, ` (-${summary.deletions})`) : null
        )
      ),
      h(
        "div",
        { className: "dsh-gw-detail-files" },
        files?.length > 0 ? h(FileTree, { files, onOpen: onOpenFile }) : h("div", { className: "dsh-gw-empty" }, "No file changes")
      )
    ) : null
  );
}
function CommitDetail(props) {
  const { repo, oid, sessionId, narrow, onOpenFile } = props;
  const [state, setState] = React.useState({ status: "loading" });
  React.useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setState({ status: "loading" });
    api("commit", { repo, oid }, sessionId, controller.signal).then((data2) => {
      if (alive) setState({ status: "ready", data: data2 });
    }).catch((error) => {
      if (!alive || controller.signal.aborted) return;
      setState({ status: "failed", error: error.message });
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [repo, oid, sessionId]);
  const data = state.data;
  const legacy = data && typeof data.text === "string" && !Array.isArray(data.parents);
  const primary = h(
    React.Fragment,
    null,
    state.status === "loading" ? h("div", { className: "dsh-gw-msg" }, "Loading\u2026") : null,
    state.status === "failed" ? h("div", { className: "dsh-gw-error" }, state.error) : null,
    legacy ? h("pre", { className: "dsh-gw-legacy" }, data.text) : null,
    data && !legacy ? h(
      "div",
      { className: "dsh-gw-kv" },
      h("span", { className: "dsh-gw-k" }, "Commit"),
      h("span", { className: "dsh-gw-v dsh-gw-mono" }, data.oid)
    ) : null
  );
  const metadata = data && !legacy ? h(
    "div",
    { className: "dsh-gw-kv" },
    h("span", { className: "dsh-gw-k" }, "Parents"),
    h(
      "span",
      { className: "dsh-gw-v dsh-gw-mono" },
      data.parents.length > 0 ? data.parents.map(shortOid).join(", ") : "None"
    ),
    h("span", { className: "dsh-gw-k" }, "Author"),
    h(
      "span",
      { className: "dsh-gw-v" },
      `${data.author.name} <${data.author.email}>`
    ),
    h("span", { className: "dsh-gw-k" }, "Committer"),
    h(
      "span",
      { className: "dsh-gw-v" },
      `${data.committer.name} <${data.committer.email}>`
    ),
    h("span", { className: "dsh-gw-k" }, "Date"),
    h(
      "span",
      { className: "dsh-gw-v" },
      `${detailedTime(data.authoredAt)} (${relativeTime(data.authoredAt)})`
    )
  ) : null;
  return h(ExpandedDetail, {
    narrow,
    primary,
    metadata,
    onOpenFile: data && !legacy ? onOpenFile : void 0,
    body: data && data.body ? h("div", { className: "dsh-gw-body" }, data.body) : null,
    summary: data && !legacy ? data.summary : null,
    files: data && !legacy ? data.files : null
  });
}
function UncommittedDetail(props) {
  const { repo, worktree, sessionId, supportsStructured, narrow, onOpenFile } = props;
  const [state, setState] = React.useState({ status: "loading" });
  React.useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    const read2 = supportsStructured ? api("uncommitted", { repo, worktree }, sessionId, controller.signal) : api("diff", { repo, worktree }, sessionId, controller.signal);
    read2.then((data2) => {
      if (alive) setState({ status: supportsStructured ? "ready" : "legacy", data: data2 });
    }).catch(async (error) => {
      if (!alive || controller.signal.aborted) return;
      if (supportsStructured && /HTTP 404/.test(error.message)) {
        try {
          const data2 = await api("diff", { repo, worktree }, sessionId, controller.signal);
          if (alive) setState({ status: "legacy", data: data2 });
          return;
        } catch (fallbackError) {
          if (!alive || controller.signal.aborted) return;
          setState({ status: "failed", error: fallbackError.message });
          return;
        }
      }
      setState({ status: "failed", error: error.message });
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [repo, worktree, sessionId, supportsStructured]);
  const data = state.data;
  const primary = h(
    React.Fragment,
    null,
    state.status === "loading" ? h("div", { className: "dsh-gw-msg" }, "Loading\u2026") : null,
    state.status === "failed" ? h("div", { className: "dsh-gw-error" }, state.error) : null,
    state.status === "legacy" ? h("div", { className: "dsh-gw-msg" }, "The Host has not reloaded yet. Showing the text diff for now.") : null,
    state.status === "legacy" && data ? h("pre", { className: "dsh-gw-legacy" }, [data.stat, data.patch].filter(Boolean).join("\n\n")) : null,
    state.status === "ready" && data ? h(
      "div",
      { className: "dsh-gw-kv" },
      h("span", { className: "dsh-gw-k" }, "Branch"),
      h("span", { className: "dsh-gw-v" }, data.unborn ? "No commits yet" : data.branch || "Detached HEAD")
    ) : null
  );
  const metadata = state.status === "ready" && data ? h(
    "div",
    { className: "dsh-gw-kv" },
    h("span", { className: "dsh-gw-k" }, "Path"),
    h("span", { className: "dsh-gw-v" }, data.path)
  ) : null;
  return h(ExpandedDetail, {
    narrow,
    primary,
    metadata,
    onOpenFile: state.status === "ready" && data ? onOpenFile : void 0,
    summary: state.status === "ready" && data ? data.summary : null,
    files: state.status === "ready" && data ? data.files : null
  });
}
function diffSplitParts(rows) {
  const parts = [];
  for (const row of rows) {
    const empty = row.left && row.right ? null : row.left ? "right" : "left";
    const last = parts[parts.length - 1];
    if (last && empty !== null && last.empty === empty) {
      last.rows.push(row);
      continue;
    }
    parts.push({ rows: [row], empty });
  }
  return parts;
}
var DIFF_STATUS_LABEL = { added: "Added", deleted: "Deleted", renamed: "Renamed", modified: "" };
var DIFF_MENU_ROWS = [
  { id: "split", label: "Split view" },
  { id: "wrap", label: "Wrap long lines" },
  { type: "separator", id: "divider" },
  { id: "copy", label: "Copy file path" }
];
function diffLineText(line) {
  return line.text.replace(/\r$/, "");
}
function diffGapBefore(hunks, index) {
  const hunk = hunks[index];
  if (index === 0) return Math.max(0, Math.min(hunk.oldStart, hunk.newStart) - 1);
  const previous = hunks[index - 1];
  const oldGap = hunk.oldStart - (previous.oldStart + previous.oldCount);
  const newGap = hunk.newStart - (previous.newStart + previous.newCount);
  return Math.max(0, Math.min(oldGap, newGap));
}
function diffSplitRows(hunk) {
  const rows = [];
  const lines = hunk.lines;
  for (let index = 0; index < lines.length; ) {
    if (lines[index].kind === "context") {
      rows.push({ left: lines[index], right: lines[index] });
      index += 1;
      continue;
    }
    const removed = [];
    const added = [];
    while (index < lines.length && lines[index].kind === "del") {
      removed.push(lines[index]);
      index += 1;
    }
    while (index < lines.length && lines[index].kind === "add") {
      added.push(lines[index]);
      index += 1;
    }
    for (let at = 0; at < Math.max(removed.length, added.length); at += 1) {
      rows.push({ left: removed[at] || null, right: added[at] || null });
    }
  }
  return rows;
}
function FileDiffView(props) {
  const { repo, worktree, path, oid, from, sessionId, actions } = props;
  const [state, setState] = React.useState({ status: "loading" });
  const [mode, setMode] = React.useState("unified");
  const [wrap, setWrap] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notice, setNotice] = React.useState(null);
  const menuAnchor = React.useRef(null);
  React.useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setState({ status: "loading" });
    api("file-diff", { repo, worktree, path, oid, from }, sessionId, controller.signal).then((data2) => {
      if (alive) setState({ status: "ready", data: data2 });
    }).catch((error) => {
      if (!alive || controller.signal.aborted) return;
      setState({
        status: "failed",
        error: /HTTP 404/.test(error.message) ? "This Harness build does not serve file patches yet. Update the plugin, restart the Host, and reload this page." : error.message
      });
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [repo, worktree, path, oid, from, sessionId]);
  const language = React.useMemo(() => (0, import_dsh_client_ui_primitives.languageForPath)(path), [path]);
  const highlight = (0, import_dsh_client_ui_primitives.useCodeHighlighter)(language);
  const runsFor = React.useMemo(() => {
    const cache = /* @__PURE__ */ new Map();
    return (text) => {
      if (!text) return [];
      const held = cache.get(text);
      if (held !== void 0) return held;
      const highlighted = highlight(text);
      const first = highlighted && highlighted[0] || [];
      const runs2 = first.length > 0 ? first : [{ text, style: {} }];
      cache.set(text, runs2);
      return runs2;
    };
  }, [highlight]);
  const runs = (line) => line ? runsFor(diffLineText(line)).map((run, at) => h("span", { key: at, style: run.style }, run.text)) : null;
  const splitEmpty = () => h(
    "div",
    { className: "dsh-gw-dsempty" },
    h("div", { className: "dsh-gw-dsnumcol" }),
    h("div", { className: "dsh-gw-dshatch" })
  );
  const splitLine = (line, old, key) => h(
    "div",
    {
      key,
      className: clsx_default("dsh-gw-dsline", `dsh-gw-dsline-${line.kind}`)
    },
    h("span", { className: "dsh-gw-dnum" }, String(old ? line.old : line.new)),
    h("span", { className: clsx_default("dsh-gw-dtext", `dsh-gw-dtext-${line.kind}`) }, runs(line))
  );
  const openTheFile = () => {
    if (!actions || typeof actions.openResource !== "function" || !sessionId || !path) {
      setNotice("This tab cannot open the file in a preview tab.");
      return;
    }
    const address = `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${path.split("/").map(encodeURIComponent).join("/")}`;
    try {
      actions.openResource(address);
    } catch (error) {
      setNotice(`Could not open the file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const onMenuSelect = (id) => {
    setMenuOpen(false);
    if (id === "split") {
      setMode((value) => value === "split" ? "unified" : "split");
      return;
    }
    if (id === "wrap") {
      setWrap((value) => !value);
      return;
    }
    if (id === "copy") {
      void (0, import_dsh_client_ui_primitives.writeClipboard)(path).then((ok) => setNotice(ok ? "Path copied" : "Could not copy the path"));
    }
  };
  const data = state.status === "ready" ? state.data : null;
  const hunks = data ? data.hunks : [];
  const body = [];
  if (state.status === "loading") body.push(h("div", { className: "dsh-gw-msg", key: "loading" }, "Reading the diff\u2026"));
  if (state.status === "failed") body.push(h("div", { className: "dsh-gw-error", key: "failed" }, state.error));
  if (data && data.note) body.push(h("div", { className: "dsh-gw-msg", key: "note" }, data.note));
  if (data && !data.note && data.binary) {
    body.push(h("div", { className: "dsh-gw-msg", key: "binary" }, "This file is binary, so its change is not shown as lines."));
  }
  if (data && !data.note && !data.binary && hunks.length === 0) {
    body.push(h("div", { className: "dsh-gw-msg", key: "empty" }, "This file has no textual change."));
  }
  for (let index = 0; index < hunks.length; index += 1) {
    const hunk = hunks[index];
    const gap = diffGapBefore(hunks, index);
    if (gap > 0) {
      body.push(h(
        "div",
        { className: "dsh-gw-dgap", key: `gap${index}` },
        h(import_dsh_client_ui_primitives.IconChevronsUpDownOutlineRegular, { size: 14, className: "dsh-gw-dgapicon" }),
        h("span", null, `${gap} unmodified line${gap === 1 ? "" : "s"}`)
      ));
    }
    if (mode === "unified") {
      body.push(h(
        "div",
        { className: "dsh-gw-hunk", key: `hunk${index}` },
        hunk.lines.map((line, at) => h(
          "div",
          {
            key: at,
            className: clsx_default("dsh-gw-dline", `dsh-gw-dline-${line.kind}`)
          },
          h("span", { className: "dsh-gw-dnum" }, String(line.new === null ? line.old : line.new)),
          h("span", { className: clsx_default("dsh-gw-dtext", `dsh-gw-dtext-${line.kind}`) }, runs(line))
        ))
      ));
      continue;
    }
    body.push(h(
      "div",
      { className: "dsh-gw-hunk dsh-gw-dsblock", key: `hunk${index}` },
      diffSplitParts(diffSplitRows(hunk)).map((part, at) => h(
        "div",
        { className: "dsh-gw-dsrow", key: at },
        part.empty === "left" ? splitEmpty() : h(
          "div",
          { className: "dsh-gw-dscol" },
          part.rows.map((row, line) => row.left ? splitLine(row.left, true, line) : null)
        ),
        part.empty === "right" ? splitEmpty() : h(
          "div",
          { className: "dsh-gw-dscol" },
          part.rows.map((row, line) => row.right ? splitLine(row.right, false, line) : null)
        )
      ))
    ));
  }
  if (data && data.truncated) {
    body.push(h("div", { className: "dsh-gw-msg", key: "cut" }, "This patch was cut short. Read the file itself for the rest."));
  }
  return h(
    "div",
    {
      className: "dsh-gw-diffpane",
      "data-wrap": wrap ? "true" : "false",
      "data-mode": mode
    },
    h(
      "div",
      { className: "dsh-gw-diffhead" },
      h(import_dsh_client_ui_primitives.FileTypeIcon, { kind: (0, import_dsh_client_ui_primitives.classifyFileType)(path), size: 16, className: "dsh-gw-difficon" }),
      h(
        "div",
        { className: "dsh-gw-difftitle" },
        h(import_dsh_client_ui_primitives.PathLabel, { path, className: "dsh-gw-diffpath" })
      ),
      // The change's own totals sit against the name they belong to; the space
      // left over is what keeps the controls at the far edge.
      data && (data.add > 0 || data.del > 0) ? h(
        "div",
        { className: "dsh-gw-diffcounts" },
        data.add > 0 ? h("span", { className: "dsh-gw-add", key: "a" }, `+${data.add}`) : null,
        data.del > 0 ? h("span", { className: "dsh-gw-del", key: "d" }, `-${data.del}`) : null
      ) : null,
      data && DIFF_STATUS_LABEL[data.status] ? h("span", { className: "dsh-gw-diffstatus" }, DIFF_STATUS_LABEL[data.status]) : null,
      // Which change this file is being read inside, so a patch opened from a
      // commit cannot be mistaken for one opened from the working tree.
      oid ? h("span", { className: "dsh-gw-diffoid dsh-gw-mono", title: oid }, shortOid(oid)) : null,
      notice ? h("span", { className: "dsh-gw-diffstatus", key: "notice" }, notice) : null,
      h("div", { className: "dsh-gw-diffspace" }),
      h(
        "div",
        { className: "dsh-gw-difftools" },
        h(import_dsh_client_ui_primitives.Menu, {
          open: menuOpen,
          portal: true,
          align: "end",
          compact: true,
          selection: "check",
          // A checked row is a state, an unchecked one is not: the two views are
          // one option that is either on or off, as are wrapped lines.
          selectedIds: [...mode === "split" ? ["split"] : [], ...wrap ? ["wrap"] : []],
          anchor: h("button", {
            type: "button",
            className: "dsh-gw-iconbtn",
            ref: menuAnchor,
            title: "View options",
            "aria-label": "View options",
            "aria-haspopup": "menu",
            "aria-expanded": menuOpen,
            onClick: () => {
              setNotice(null);
              setMenuOpen((open) => !open);
            }
          }, h(import_dsh_client_ui_primitives.IconEllipsisOutlineRegular, { size: 15 })),
          items: [
            { id: "split", label: "Split view", icon: h(import_dsh_client_ui_primitives.IconCompareSplitOutlineRegular, { size: 16 }) },
            { id: "wrap", label: "Wrap long lines", icon: h(import_dsh_client_ui_primitives.IconWrapLinesOutlineRegular, { size: 16 }) },
            DIFF_MENU_ROWS[2],
            { id: "copy", label: "Copy file path", icon: h(import_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 16 }) }
          ],
          onSelect: onMenuSelect,
          onClose: () => setMenuOpen(false),
          // The column clips at its own edges, so the list is drawn over the
          // page from the button's own rectangle rather than inside it.
          getAnchorRect: () => menuAnchor.current ? menuAnchor.current.getBoundingClientRect() : null
        }),
        h("button", {
          type: "button",
          className: "dsh-gw-iconbtn",
          title: "Open this file in a preview tab",
          "aria-label": "Open this file in a preview tab",
          disabled: !(actions && typeof actions.openResource === "function"),
          onClick: openTheFile
        }, h(import_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 15 }))
      )
    ),
    // The lines scroll; the header above them does not, so the file's name and
    // its counts stay readable however far a line is scrolled sideways.
    h(
      "div",
      { className: "dsh-gw-difflines" },
      h("div", { className: "dsh-gw-diffbody" }, body)
    )
  );
}
function FileDiffTab(props) {
  const info = typeof props.useTabInfo === "function" ? props.useTabInfo() : null;
  const tab = info ? info.tab : null;
  const params = tab && tab.navigation && tab.navigation.params || {};
  return h(FileDiffView, {
    repo: params.repo || null,
    worktree: params.worktree || null,
    path: String(params.path || ""),
    oid: params.oid || null,
    from: params.from || null,
    sessionId: props.sessionId || tab && tab.sessionId || null,
    // The tab system's own actions, so the view can open the file it is
    // showing in a preview tab without knowing how tabs are opened.
    actions: tab && tab.actions || null
  });
}
function FileDiffTitle(props) {
  const info = typeof props.useTabInfo === "function" ? props.useTabInfo() : null;
  const tab = info ? info.tab : null;
  const params = tab && tab.navigation && tab.navigation.params || {};
  const name = String(params.path || "").split("/").filter(Boolean).pop();
  return h(React.Fragment, null, h(DiffMarkGlyph, { size: 16 }), name || FILE_DIFF_TITLE);
}
var Boundary = class extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return h(
        "div",
        { className: "dsh-gw" },
        h("div", { className: "dsh-gw-error" }, `Git Worktree panel failed to render: ${this.state.error.message}`)
      );
    }
    return this.props.children;
  }
};
function WorktreeTab(props) {
  const info = typeof props.useTabInfo === "function" ? props.useTabInfo() : null;
  const tab = info ? info.tab : null;
  const sessionId = props.sessionId || tab && tab.sessionId || "current";
  const navigate = tab && tab.navigation ? tab.navigation.params : null;
  const saved = viewState.get(sessionId) || {};
  const [state, setState] = React.useState({
    status: "loading",
    repo: null,
    resolved: false,
    worktrees: [],
    graph: null,
    nodes: [],
    capabilities: [],
    error: null,
    sessionId: null,
    more: false,
    // A page that came back shorter than the one asked for is the end of the
    // history. The Host answers no "has more" field, so the requested page
    // size is the only thing separating "stopped here" from "that is all
    // there is" — without it a two-commit repository was offered a button
    // that could only ever fetch nothing.
    exhausted: false
  });
  const [selected, setSelected] = React.useState(null);
  const [scope, setScope] = React.useState(saved.scope || "all");
  const [showRemote, setShowRemote] = React.useState(Boolean(saved.showRemote));
  const [showGraph] = React.useState(true);
  const [openKey, setOpenKey] = React.useState(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [width, setWidth] = React.useState(900);
  const [height, setHeight] = React.useState(720);
  const [menu, setMenu] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const remoteParam = showRemote ? "1" : "0";
  const repo = navigate && navigate.repo || (state.sessionId === sessionId ? state.repo : null) || null;
  const rootRef = React.useRef(null);
  React.useEffect(() => {
    const node = rootRef.current;
    if (!node) return void 0;
    const measure = () => {
      setWidth(node.clientWidth || 900);
      setHeight(node.clientHeight || 720);
    };
    if (typeof ResizeObserver !== "function") {
      measure();
      return void 0;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  React.useEffect(() => {
    viewState.set(sessionId, { scope, showRemote });
  }, [sessionId, scope, showRemote]);
  React.useEffect(() => {
    if (state.resolved && state.sessionId === sessionId) return void 0;
    const controller = new AbortController();
    let alive = true;
    const resolve = async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await api("worktrees", { repo }, sessionId, controller.signal);
        } catch (error) {
          if (!alive || controller.signal.aborted || attempt >= RESOLVE_ATTEMPTS) throw error;
          await new Promise((resolveWait) => setTimeout(resolveWait, RESOLVE_BACKOFF_MS * (attempt + 1)));
        }
      }
    };
    resolve().then((data) => {
      if (!alive) return;
      const current2 = data.worktrees.find((item) => samePath(item.path, data.repo.root)) || data.worktrees[0] || null;
      if (current2) setSelected(current2.path);
      setState((previous) => ({
        ...previous,
        status: "ready",
        repo: data.repo.root,
        resolved: true,
        worktrees: data.worktrees,
        capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
        error: null,
        sessionId
      }));
    }).catch((error) => {
      if (!alive || controller.signal.aborted) return;
      setState((previous) => ({ ...previous, status: "failed", error: error.message }));
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [reloadKey, sessionId, state.resolved]);
  React.useEffect(() => {
    if (!repo || !selected) return void 0;
    const controller = new AbortController();
    let alive = true;
    api("graph", { repo, worktree: selected, scope, remote: remoteParam, limit: PAGE }, sessionId, controller.signal).then((data) => {
      if (!alive) return;
      setState((previous) => ({
        ...previous,
        graph: data,
        nodes: data.nodes,
        exhausted: data.nodes.length < PAGE,
        error: null
      }));
    }).catch((error) => {
      if (!alive || controller.signal.aborted) return;
      setState((previous) => ({ ...previous, error: error.message }));
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [repo, selected, scope, remoteParam, reloadKey]);
  const loadMore = React.useCallback(() => {
    if (!repo || !selected || state.more || state.exhausted) return;
    setState((previous) => ({ ...previous, more: true }));
    api("graph", { repo, worktree: selected, scope, remote: remoteParam, limit: PAGE, skip: state.nodes.length }, sessionId).then((data) => {
      setState((previous) => ({
        ...previous,
        more: false,
        exhausted: data.nodes.length < PAGE,
        // Lane numbers continue across pages, so appending keeps every
        // earlier row exactly where it was drawn.
        nodes: previous.nodes.concat(data.nodes)
      }));
    }).catch((error) => {
      setState((previous) => ({ ...previous, more: false, error: error.message }));
    });
  }, [repo, selected, scope, remoteParam, sessionId, state.more, state.exhausted, state.nodes.length]);
  const onToggle = React.useCallback((key) => {
    setOpenKey((current2) => current2 === key ? null : key);
  }, []);
  const operations = transport && transport.operations ? transport.operations : null;
  const openPreview = async (operation, commit) => {
    if (!operations || !repo || !selected) return;
    setMenu(null);
    setState((previous) => ({ ...previous, error: null }));
    try {
      setPreview(operation === "rebase" ? await operations.rebasePreview({ repo, worktree: selected, target: commit }) : await operations.cherryPickPreview({ repo, worktree: selected, commit }));
    } catch (error) {
      setState((previous) => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
    }
  };
  const applyPreview = async () => {
    if (!operations || !preview) return;
    const run = preview.operation === "rebase" ? operations.rebaseApply : operations.cherryPickApply;
    try {
      await run({ planId: preview.planId, confirm: true });
      setPreview(null);
      setState((previous) => ({ ...previous, status: "loading", resolved: false, error: null }));
      setReloadKey((key) => key + 1);
    } catch (error) {
      setPreview(null);
      setState((previous) => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
    }
  };
  const nodes = state.nodes || [];
  const layout = React.useMemo(() => layoutLanes(nodes), [nodes]);
  const openFile = (file, oid) => {
    const actions = tab && tab.actions;
    const params = {
      repo: state.repo,
      worktree: selected,
      path: file.path,
      oid,
      from: file.from || null
    };
    if (!actions || typeof actions.openTab !== "function") {
      setState((previous) => ({
        ...previous,
        error: "This tab cannot open another one. Reload the Harness window to pick up the current build of this plugin."
      }));
      return;
    }
    try {
      actions.openTab(FILE_DIFF_KIND, { params });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: `Could not open the diff tab: ${error instanceof Error ? error.message : String(error)}`
      }));
    }
  };
  const current = state.worktrees.find((item) => samePath(item.path, selected)) || null;
  const changeCount = current && current.status ? current.status.entries : 0;
  const dirty = changeCount > 0;
  const headOid = state.graph ? state.graph.head : null;
  const worktreeBranch = state.graph ? state.graph.branch : null;
  const worktreeLink = dirty && Boolean(headOid) && nodes.length > 0 && nodes[0].id === headOid;
  const colors = /* @__PURE__ */ new Map();
  for (const lane of layout.lanes) {
    if (colors.has(lane)) continue;
    colors.set(lane, LANE_COLORS[lane % LANE_COLORS.length]);
  }
  const graphWidth = Math.max(64, PAD + layout.width * COL + MARGIN);
  const detailNarrow = width - (showGraph ? graphWidth : 0) - 16 < DETAIL_TWO_COLUMN_MIN;
  const detailMax = Math.max(
    DETAIL_MAX_FLOOR,
    Math.min(DETAIL_MAX_CEILING, Math.round(height * DETAIL_MAX_SHARE))
  );
  const trackWidth = Math.max(0, width - COLUMN_GUTTER);
  const textWidth = trackWidth - graphWidth;
  const showDate = textWidth >= DESCRIPTION_MIN + DATE_MIN;
  const showAuthor = textWidth >= DESCRIPTION_MIN + DATE_MIN + AUTHOR_MIN;
  const extra = Math.max(0, textWidth - DESCRIPTION_MIN - (showDate ? DATE_MIN : 0) - (showAuthor ? AUTHOR_MIN : 0));
  const dateWidth = showAuthor ? Math.min(DATE_MAX, DATE_MIN + Math.floor(extra * 0.12)) : Math.min(DATE_MAX, DATE_MIN + Math.floor(extra * 0.15));
  const authorWidth = Math.min(AUTHOR_MAX, AUTHOR_MIN + Math.floor(extra * 0.12));
  const columns = [
    ...showGraph ? [`${graphWidth}px`] : [],
    "minmax(0, 1fr)",
    ...showDate ? [`${dateWidth}px`] : [],
    ...showAuthor ? [`${authorWidth}px`] : []
  ].join(" ");
  const toolbar = h(
    "div",
    { className: "dsh-gw-tbar" },
    current ? h(import_dsh_client_ui_primitives.PathLabel, {
      path: current.path,
      className: "dsh-gw-wt",
      key: "wt-path"
    }) : h(
      "span",
      { className: "dsh-gw-wt-placeholder", title: state.status === "failed" ? "Repository unavailable" : "Loading worktrees" },
      state.status === "failed" ? "Repository unavailable" : "Loading\u2026"
    ),
    h(
      "div",
      { className: "dsh-gw-icons" },
      h("button", {
        type: "button",
        className: "dsh-gw-iconbtn",
        title: showRemote ? "Showing remote branches; click to show local only" : "Showing local branches; click to include remotes",
        "aria-label": "Show remote branches",
        "aria-pressed": showRemote,
        onClick: () => setShowRemote((value) => !value)
      }, h(RemoteCloudIcon, { hidden: !showRemote })),
      h("button", {
        type: "button",
        className: "dsh-gw-iconbtn",
        title: "Refresh",
        "aria-label": "Refresh",
        onClick: () => {
          setState((previous) => ({ ...previous, status: "loading", resolved: false, error: null }));
          setReloadKey((key) => key + 1);
          setOpenKey(null);
        }
      }, h(import_dsh_client_ui_primitives.IconRefreshOutlineRegular))
    )
  );
  const head = [];
  head.push(toolbar);
  if (state.error) head.push(h("div", { className: "dsh-gw-error", key: "error" }, state.error));
  if (state.status === "loading") head.push(h("div", { className: "dsh-gw-msg", key: "loading" }, "Loading repository\u2026"));
  const grid = [];
  if (state.repo && state.status === "ready" && changeCount > 0) {
    grid.push(h(
      "div",
      {
        key: "uncommitted",
        className: clsx_default("dsh-gw-row", openKey === "uncommitted" && "dsh-gw-row-open"),
        style: { "--dsh-gw-cols": columns },
        role: "button",
        tabIndex: 0,
        "aria-expanded": openKey === "uncommitted",
        onClick: () => onToggle("uncommitted"),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle("uncommitted");
          }
        }
      },
      showGraph ? h("div", { className: "dsh-gw-gcell" }, h(
        "svg",
        {
          width: graphWidth,
          height: ROW,
          "aria-hidden": true
        },
        worktreeLink ? h("line", { x1: laneX(0), y1: ROW / 2, x2: laneX(0), y2: ROW, stroke: "var(--dsw-alias-label-secondary)", strokeWidth: 1.6 }) : null,
        h("circle", { cx: laneX(0), cy: ROW / 2, r: 4.5, fill: "var(--dsw-alias-bg-base)", stroke: "var(--dsw-alias-label-secondary)", strokeWidth: 2 })
      )) : null,
      h(
        "div",
        { className: "dsh-gw-cell" },
        h(
          "span",
          { className: "dsh-gw-subjtext dsh-gw-uncommitted" },
          `Uncommitted Changes (${changeCount})`
        ),
        h("span", { className: "dsh-gw-dot" })
      ),
      showDate ? h("div", { className: "dsh-gw-cell dsh-gw-cell-sec" }, "") : null,
      showAuthor ? h("div", { className: "dsh-gw-cell dsh-gw-cell-sec" }, "") : null
    ));
    if (openKey === "uncommitted") {
      grid.push(h(DetailRegion, {
        key: "uncommitted-detail",
        max: detailMax,
        // The working tree's row is not a lane of its own, so its band
        // carries the connector instead: `index: -1` matches no edge.
        rail: showGraph ? h(GraphRail, { layout, index: -1, colors, worktree: worktreeLink, width: graphWidth }) : null
      }, h(UncommittedDetail, {
        repo: state.repo,
        worktree: selected,
        sessionId,
        narrow: detailNarrow,
        supportsStructured: state.capabilities.includes("uncommitted-v1"),
        // The working tree's own change: a patch with no commit behind it.
        onOpenFile: (file) => openFile(file, null)
      })));
    }
  }
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const laneColor = colors.get(layout.lanes[index]) || LANE_COLORS[0];
    const isHead = Boolean(headOid) && node.id === headOid;
    const visibleRefs = (node.refs || []).map(normalizeRef).filter(Boolean).filter((ref) => ref.kind === "branch" || ref.kind === "worktree").sort((left, right) => (right.kind === "worktree" ? 0 : 1) - (left.kind === "worktree" ? 0 : 1));
    const refs = mergeWorktreeBranch(visibleRefs, worktreeBranch);
    const counted = (node.refs || []).every((ref) => ref.kind === "branch" || ref.kind === "worktree");
    const hiddenRefs = counted ? (node.refCount || 0) - visibleRefs.length : 0;
    grid.push(h(
      "div",
      {
        key: node.id,
        className: clsx_default("dsh-gw-row", isHead && "dsh-gw-row-head", openKey === node.id && "dsh-gw-row-open"),
        style: { "--dsh-gw-cols": columns },
        role: "button",
        tabIndex: 0,
        "aria-expanded": openKey === node.id,
        onClick: () => onToggle(node.id),
        onContextMenu: operations ? (event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY, commit: node.id });
        } : void 0,
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle(node.id);
          }
        },
        title: `${shortOid(node.id)} ${node.subject}`
      },
      showGraph ? h(GraphCell, {
        layout,
        index,
        colors,
        head: isHead && !dirty,
        above: worktreeLink && index === 0
      }) : null,
      h(
        "div",
        { className: "dsh-gw-cell" },
        h(
          "div",
          { className: "dsh-gw-subj" },
          refs.map((ref) => h(RefChip, {
            key: `${ref.kind}:${ref.name}`,
            gitRef: ref,
            laneColor
          })),
          hiddenRefs > 0 ? h("span", { className: "dsh-gw-ref", title: "More local branches" }, `+${hiddenRefs}`) : null,
          h("span", { className: "dsh-gw-subjtext" }, node.subject || "(no commit message)")
        )
      ),
      showDate ? h(
        "div",
        { className: "dsh-gw-cell dsh-gw-cell-sec", title: absoluteTime(node.authoredAt) },
        absoluteTime(node.authoredAt)
      ) : null,
      showAuthor ? h("div", { className: "dsh-gw-cell dsh-gw-cell-sec", title: node.author || "" }, node.author || "") : null
    ));
    if (openKey === node.id) {
      grid.push(h(DetailRegion, {
        key: `${node.id}-detail`,
        max: detailMax,
        rail: showGraph ? h(GraphRail, { layout, index, colors, width: graphWidth }) : null
      }, h(CommitDetail, {
        repo: state.repo,
        oid: node.id,
        sessionId,
        narrow: detailNarrow,
        onOpenFile: (file) => openFile(file, node.id)
      })));
    }
  }
  if (state.status === "ready" && nodes.length > 0 && state.graph && !state.exhausted) {
    grid.push(h(
      "div",
      { className: "dsh-gw-more", key: "more" },
      h(
        import_dsh_client_ui_primitives.Button,
        { type: "button", variant: "outline", size: "sm", disabled: state.more, onClick: loadMore },
        state.more ? "Loading\u2026" : "Load more"
      )
    ));
  }
  if (state.status === "ready" && state.graph && state.graph.unborn) {
    grid.push(h("div", { className: "dsh-gw-empty", key: "unborn" }, "This repository has no commits yet; only uncommitted changes."));
  } else if (state.status === "ready" && !state.repo) {
    grid.push(h("div", { className: "dsh-gw-empty", key: "norepo" }, "No repository path is available."));
  } else if (state.status === "ready" && nodes.length === 0) {
    grid.push(h("div", {
      className: "dsh-gw-empty",
      key: "empty",
      title: JSON.stringify({ root: state.repo, selected, scope })
    }, state.graph ? "No commits in this range." : "The graph is still loading, or the last request failed."));
  }
  return h(
    "div",
    {
      className: "dsh-gw",
      ref: rootRef,
      style: { "--dsh-gw-row-height": `${ROW}px` }
    },
    head,
    h(
      "div",
      { className: "dsh-gw-scroll" },
      h("div", { className: "dsh-gw-grid" }, grid)
    ),
    menu && operations ? h(import_dsh_client_ui_primitives.Menu, {
      open: true,
      anchor: h("span", { "aria-hidden": true }),
      portal: true,
      autoFocus: true,
      getAnchorRect: () => new DOMRect(menu.x, menu.y - 4, 0, 0),
      items: [
        { id: "rebase", label: "Rebase onto this commit" },
        { id: "cherry-pick", label: "Cherry-pick this commit" }
      ],
      onSelect: (id) => void openPreview(id, menu.commit),
      onClose: () => setMenu(null)
    }) : null,
    preview ? h(
      import_dsh_client_ui_primitives.Modal,
      {
        open: true,
        title: preview.operation === "rebase" ? "Confirm rebase" : "Confirm cherry-pick",
        closeLabel: "Close",
        onClose: () => setPreview(null),
        backdropBlur: false,
        className: "dsh-gw-modal",
        footer: h(
          "div",
          { className: "dsh-gw-actions" },
          h(import_dsh_client_ui_primitives.Button, { type: "button", variant: "outline", size: "sm", onClick: () => setPreview(null) }, "Cancel"),
          h(
            import_dsh_client_ui_primitives.Button,
            { type: "button", variant: "outline", size: "sm", className: "dsh-gw-danger", onClick: () => void applyPreview() },
            preview.operation === "rebase" ? "Rebase" : "Cherry-pick"
          )
        )
      },
      h("p", null, "Worktree: ", h("code", null, preview.worktreePath)),
      h("p", null, "Branch: ", h("strong", null, preview.branch), " \xB7 HEAD ", h("code", null, preview.head.slice(0, 8))),
      h("p", null, "Target commit: ", h("code", null, preview.targetCommit.slice(0, 8))),
      h("p", null, `Preview includes ${preview.commits.length} commit${preview.commits.length === 1 ? "" : "s"} \xB7 expires at ${new Date(preview.expiresAt).toLocaleTimeString("en-US")}`),
      h(
        "details",
        null,
        h("summary", null, "View commits"),
        h("ol", null, preview.commits.map((commit) => h("li", { key: commit }, h("code", { title: commit }, commit.slice(0, 12)))))
      ),
      preview.warnings.map((warning) => h("p", { className: "dsh-gw-warn", key: warning }, warning))
    ) : null
  );
}
function WorktreeTitle() {
  return h(React.Fragment, null, h(import_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 }), WORKTREE_TAB_TITLE);
}
var GuideIcon = () => h(
  "svg",
  {
    viewBox: "0 0 16 16",
    width: 16,
    height: 16,
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round"
  },
  h("circle", { cx: 4, cy: 4, r: 2 }),
  h("circle", { cx: 4, cy: 12, r: 2 }),
  h("circle", { cx: 12, cy: 8, r: 2 }),
  h("path", { d: "M4 6v4M6 4h3a3 3 0 0 1 3 3v1" })
);

// src/client.ts
var API = "/git-worktree-graph/api";
var KIND = "git-worktree-graph";
var NS = "@JinzhaoTian/git-worktree-graph";
var DIFF_ID = `${NS}/file-diff`;
async function read(action, params = {}, sessionId, signal) {
  const url = new URL(`${API}/${action}`, window.location.origin);
  if (sessionId) url.searchParams.set("session", sessionId);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== void 0 && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || payload.ok !== true) throw new Error(payload && payload.error || "Request failed.");
  return payload.data;
}
async function write(action, params) {
  const response = await fetch(`${API}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(params || {})
  });
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || payload.ok !== true) throw new Error(payload && payload.error || "Request failed.");
  return payload.data;
}
var transport2 = {
  worktrees: (params, sessionId, signal) => read("worktrees", params, sessionId, signal),
  graph: (params, sessionId, signal) => read("graph", params, sessionId, signal),
  diff: (params, sessionId, signal) => read("diff", params, sessionId, signal),
  commit: (params, sessionId, signal) => read("commit", params, sessionId, signal),
  uncommitted: (params, sessionId, signal) => read("uncommitted", params, sessionId, signal),
  "file-diff": (params, sessionId, signal) => read("file-diff", params, sessionId, signal),
  operations: {
    createWorktree: (params) => write("worktree-create", params),
    rebasePreview: (params) => write("rebase-preview", params),
    rebaseApply: (params) => write("rebase-apply", params),
    cherryPickPreview: (params) => write("cherry-pick-preview", params),
    cherryPickApply: (params) => write("cherry-pick-apply", params)
  }
};
function apply(ctx) {
  configureView(transport2);
  ctx.effect(() => {
    const sheet = document.createElement("style");
    sheet.setAttribute("data-dsh-plugin", NS);
    sheet.textContent = CSS_MODULE_TEXT;
    (document.head || document.documentElement).appendChild(sheet);
    return () => sheet.remove();
  }, "git-worktree-graph: stylesheet");
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: NS,
    kind: KIND,
    multiple: false,
    priority: "builtin",
    title: () => WORKTREE_TAB_TITLE,
    guide: [{
      id: "open",
      order: 60,
      title: () => WORKTREE_TAB_TITLE,
      description: () => "Browse worktrees, branches, and commit history for this workspace",
      icon: GuideIcon
    }]
  }), "git-worktree-graph: tab type");
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: DIFF_ID,
    kind: FILE_DIFF_KIND,
    multiple: false,
    priority: "builtin",
    title: () => FILE_DIFF_TITLE
  }), "git-worktree-graph: diff tab type");
  ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: NS
  }, (props) => React2.createElement(Boundary, null, React2.createElement(WorktreeTab, { ...props }))));
  ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
    name: "sidebar.right.pane.tab.title",
    key: NS
  }, WorktreeTitle));
  ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: DIFF_ID
  }, (props) => React2.createElement(Boundary, null, React2.createElement(FileDiffTab, { ...props }))));
  ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
    name: "sidebar.right.pane.tab.title",
    key: DIFF_ID
  }, FileDiffTitle));
}
var client_default = {
  inject: ["slots", "sidebarRightTabs"],
  apply
};
    return module.exports.default ?? module.exports;
  },
});
