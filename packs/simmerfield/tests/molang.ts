// A tiny evaluator for the Molang subset our block JSON conditions use, so tests can check which
// permutations apply to which block states: q.block_state('name') / query.block_state('name'),
// 'strings', numbers, true/false, == != >= <= > <, !, &&, || and parentheses. Anything else throws.
// Not a Molang implementation: just enough to evaluate our own generated conditions.

export type MolangValue = string | number | boolean;

const TOKEN =
  /\s*(?:(?:q|query)\.block_state\('([^']+)'\)|'([^']*)'|(true|false)|(\d+(?:\.\d+)?)|(==|!=|>=|<=|&&|\|\||[()!<>]))/y;

type Token =
  | { kind: "value"; value: MolangValue }
  | { kind: "state"; name: string }
  | { kind: "op"; op: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < expr.length) {
    if (/^\s*$/.test(expr.slice(TOKEN.lastIndex))) break;
    const at = TOKEN.lastIndex;
    const m = TOKEN.exec(expr);
    if (!m) throw new Error(`can't parse "${expr.slice(at)}" in ${expr}`);
    const [, state, str, bool, num, op] = m;
    if (state !== undefined) tokens.push({ kind: "state", name: state });
    else if (str !== undefined) tokens.push({ kind: "value", value: str });
    else if (bool !== undefined) tokens.push({ kind: "value", value: bool === "true" });
    else if (num !== undefined) tokens.push({ kind: "value", value: Number(num) });
    else if (op !== undefined) tokens.push({ kind: "op", op });
  }
  return tokens;
}

/** Evaluates `expr` with the given block states; throws on unknown states or syntax. */
export function evalCondition(
  expr: string,
  states: Readonly<Record<string, MolangValue>>,
): boolean {
  const tokens = tokenize(expr);
  let pos = 0;
  const peek = () => tokens[pos];
  const takeOp = (op: string) => {
    const t = peek();
    if (t?.kind === "op" && t.op === op) {
      pos++;
      return true;
    }
    return false;
  };

  function primary(): MolangValue {
    const t = tokens[pos++];
    if (!t) throw new Error(`unexpected end of ${expr}`);
    if (t.kind === "value") return t.value;
    if (t.kind === "state") {
      const value = states[t.name];
      if (value === undefined) throw new Error(`unknown state ${t.name} in ${expr}`);
      return value;
    }
    if (t.op === "(") {
      const value = or();
      if (!takeOp(")")) throw new Error(`missing ) in ${expr}`);
      return value;
    }
    if (t.op === "!") return !primary();
    throw new Error(`unexpected ${t.op} in ${expr}`);
  }

  function comparison(): MolangValue {
    const left = primary();
    const t = peek();
    if (t?.kind !== "op" || !["==", "!=", ">=", "<=", ">", "<"].includes(t.op)) return left;
    pos++;
    const right = primary();
    switch (t.op) {
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      case ">=":
        return Number(left) >= Number(right);
      case "<=":
        return Number(left) <= Number(right);
      case ">":
        return Number(left) > Number(right);
      default:
        return Number(left) < Number(right);
    }
  }

  function and(): MolangValue {
    let value = comparison();
    while (takeOp("&&")) {
      const right = comparison();
      value = Boolean(value) && Boolean(right);
    }
    return value;
  }

  function or(): MolangValue {
    let value = and();
    while (takeOp("||")) {
      const right = and();
      value = Boolean(value) || Boolean(right);
    }
    return value;
  }

  const result = or();
  if (pos !== tokens.length) throw new Error(`trailing tokens in ${expr}`);
  return Boolean(result);
}
