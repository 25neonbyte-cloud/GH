import test from 'node:test'; import assert from 'node:assert/strict';
import { calcularLOS } from '../src/utils/los.js'; import { senhaForte, cpfBasico } from '../src/utils/validation.js';
test('calcula LOS em dias inteiros',()=>assert.equal(calcularLOS('2026-09-10T10:00:00Z','2026-09-15T12:00:00Z'),5));
test('LOS nunca é negativo',()=>assert.equal(calcularLOS('2026-09-15','2026-09-10'),0));
test('senha forte exige 8 caracteres, letra e número',()=>{assert.equal(senhaForte('abc12345'),true);assert.equal(senhaForte('abcdefgh'),false);assert.equal(senhaForte('12345678'),false);});
test('validador básico de CPF',()=>{assert.equal(cpfBasico('52998224725'),true);assert.equal(cpfBasico('11111111111'),false);});
