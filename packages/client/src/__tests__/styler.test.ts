import { it, describe } from "node:test";
import assert from "node:assert/strict";
import * as styler from "../styler.ts";

const name = "color";
const strValue = "A";
const arrValue = ["A", "B", "C"];
const objValue = { A: "100", B: "150", C: "200" };

describe("styler", () => {
  it('matrix', () => {
    assert.equal(styler.matrix(name, undefined), undefined);
    assert.equal(styler.matrix(name, Symbol()), undefined);
    assert.equal(
      styler.matrix(name, () => { }),
      undefined
    );
    assert.equal(styler.matrix(name, []), undefined);
    assert.equal(styler.matrix(name, {}), undefined);
    assert.equal(styler.matrix(name, null), undefined);

    assert.equal(styler.matrix(name, strValue), `;color=A`);
    assert.equal(styler.matrix(name, strValue, true), `;color=A`);

    assert.equal(styler.matrix(name, arrValue), `;color=A,B,C`);
    assert.equal(styler.matrix(name, arrValue, true), `;color=A;color=B;color=C`);

    assert.equal(styler.matrix(name, objValue), `;color=A,100,B,150,C,200`);
    assert.equal(styler.matrix(name, objValue, true), `;A=100;B=150;C=200`);
  })

  it('label', () => {
    assert.equal(styler.label(undefined), undefined);
    assert.equal(styler.label(Symbol()), undefined);
    assert.equal(
      styler.label(() => { }),
      undefined
    );
    assert.equal(styler.label([]), undefined);
    assert.equal(styler.label({}), undefined);
    assert.equal(styler.label(null), undefined);

    assert.equal(styler.label(strValue), `.A`);
    assert.equal(styler.label(strValue, true), `.A`);

    assert.equal(styler.label(arrValue), `.A,B,C`);
    assert.equal(styler.label(arrValue, true), `.A.B.C`);

    assert.equal(styler.label(objValue), `.A,100,B,150,C,200`);
    assert.equal(styler.label(objValue, true), `.A=100.B=150.C=200`);
  })

  it('simple', () => {
    assert.equal(styler.simple(undefined), undefined);
    assert.equal(styler.simple(Symbol()), undefined);
    assert.equal(
      styler.simple(() => { }),
      undefined
    );
    assert.equal(styler.simple([]), undefined);
    assert.equal(styler.simple({}), undefined);

    assert.equal(styler.simple(null), undefined);
    assert.equal(styler.simple(strValue), `A`);
    assert.equal(styler.simple(strValue, true), `A`);

    assert.equal(styler.simple(arrValue), `A,B,C`);
    assert.equal(styler.simple(arrValue, true), `A,B,C`);

    assert.equal(styler.simple(objValue), `A,100,B,150,C,200`);
    assert.equal(styler.simple(objValue, true), `A=100,B=150,C=200`);
  })

  it('form', () => {
    assert.equal(styler.form(name, undefined), undefined);
    assert.equal(styler.form(name, Symbol()), undefined);
    assert.equal(
      styler.form(name, () => { }),
      undefined
    );
    assert.equal(styler.form(name, []), undefined);
    assert.equal(styler.form(name, {}), undefined);
    assert.equal(styler.form(name, null), undefined);

    assert.equal(styler.form(name, strValue), `color=A`);
    assert.equal(styler.form(name, strValue, true), `color=A`);

    assert.equal(styler.form(name, arrValue), `color=A,B,C`);
    assert.equal(styler.form(name, arrValue, true), `color=A&color=B&color=C`);

    assert.equal(styler.form(name, objValue), `color=A,100,B,150,C,200`);
    assert.equal(styler.form(name, objValue, true), `A=100&B=150&C=200`);
  })

  it('deep', () => {
    assert.equal(
      styler.deep(name, objValue),
      `color[A]=100&color[B]=150&color[C]=200`
    );

    assert.equal(
      styler.deep("obj", { a: [1, 2, 3, 4] }),
      `obj[a][0]=1&obj[a][1]=2&obj[a][2]=3&obj[a][3]=4`
    );

    assert.equal(
      styler.deep("obj", { a: { b: { c: "100", d: "200" } } }),
      `obj[a][b][c]=100&obj[a][b][d]=200`
    );
  })
})

