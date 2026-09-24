/**
 * Payload field separators.
 *
 * `git log` and `git show` are asked for records rather than text: one control
 * character between fields and one between records, so a commit subject that
 * contains a tab, a newline, or a pipe still parses. `git` never emits these.
 */
export const FIELD = '\x1f';
export const RECORD = '\x1e';
