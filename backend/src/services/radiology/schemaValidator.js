// WS2-07: the radiology LLM's JSON output was previously stored verbatim with no
// validation against the schema it was prompted with — invented fields passed
// through untouched, wrong-typed values (e.g. fatty_grade: "2" as a string) flowed
// into scorers unchecked, and a hallucinated enum value (not in the closed
// vocabulary a scorer's switch/case actually handles) could silently no-op a risk
// check. This walks the same pseudo-schema DSL used to build the LLM prompt
// (leaf type strings like 'number | null', 'normal | poor | lost', arrays of
// object templates) and coerces/rejects the LLM's actual response against it.
const PRIMITIVE_TOKENS = ['number', 'string', 'boolean', 'null'];
const NUMERIC_TOKEN = /^-?\d+(\.\d+)?$/;

function coerceLeaf(value, typeStr) {
  if (value === null || value === undefined) return null;

  const options = typeStr.split('|').map((s) => s.trim());
  const isPrimitiveDecl = options.every((o) => PRIMITIVE_TOKENS.includes(o));

  if (isPrimitiveDecl) {
    const primitive = options.find((o) => o !== 'null');
    if (primitive === 'boolean') {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return null;
    }
    if (primitive === 'number') {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    if (primitive === 'string') {
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return null;
    }
    // primitive === undefined means the whole spec was just 'null' — not a real case.
    return null;
  }

  // Closed enum (word tokens and/or numeric-literal tokens), e.g.
  // 'normal | poor | lost', 'null | 1 | 2 | 3', 'PA | AP | lateral | unknown'.
  const candidate = String(value);
  const match = options.find((o) => o === candidate);
  if (match === undefined) {
    // Hallucinated / out-of-vocabulary value — reject rather than pass through a
    // value no scorer's comparison branch recognizes.
    return null;
  }
  // Numeric-literal enum members (e.g. varicocele/diastolic-dysfunction grade,
  // compared downstream with === / >=) must stay real numbers, not strings.
  return NUMERIC_TOKEN.test(match) ? Number(match) : match;
}

function coerceAndValidate(value, schemaNode) {
  if (typeof schemaNode === 'string') {
    return coerceLeaf(value, schemaNode);
  }

  if (Array.isArray(schemaNode)) {
    const itemSchema = schemaNode[0];
    if (!Array.isArray(value)) return [];
    return value.map((item) => coerceAndValidate(item, itemSchema));
  }

  if (schemaNode && typeof schemaNode === 'object') {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const result = {};
    for (const key of Object.keys(schemaNode)) {
      result[key] = coerceAndValidate(source[key], schemaNode[key]);
    }
    return result;
  }

  return null;
}

module.exports = { coerceAndValidate };
