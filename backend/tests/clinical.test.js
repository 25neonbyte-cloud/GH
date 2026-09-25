import test from 'node:test';
import assert from 'node:assert/strict';
import { categoriaPorCargo, normalizarMedicoes, validarConteudoTemplate } from '../src/services/clinicalService.js';

test('categoria profissional é derivada do cargo',()=>{
  assert.equal(categoriaPorCargo('MÉDICO | CARDIOLOGIA'),'MEDICA');
  assert.equal(categoriaPorCargo('ENFERMEIRO'),'ENFERMAGEM');
  assert.equal(categoriaPorCargo('FISIOTERAPEUTA'),'FISIOTERAPIA');
  assert.equal(categoriaPorCargo('ASSISTENTE SOCIAL'),'MULTIPROFISSIONAL');
});

test('medidas clínicas válidas são normalizadas',()=>{
  const data=normalizarMedicoes({pa:'120/80',fc:'80',fr:'18',temp:'36.7',spo2:'98',glicemia:'105'});
  assert.equal(data.length,6);
  assert.equal(data.find(x=>x.codigo==='pa').valorTexto,'120/80');
  assert.equal(data.find(x=>x.codigo==='fc').valorNumerico,80);
});

test('medidas clínicas inválidas são rejeitadas',()=>{
  assert.throws(()=>normalizarMedicoes({pa:'12345'}),/Pressão arterial/);
  assert.throws(()=>normalizarMedicoes({fc:'123456789as'}),/numérica/);
  assert.throws(()=>normalizarMedicoes({temp:'abc123'}),/numérica/);
  assert.throws(()=>normalizarMedicoes({spo2:'12-3456'}),/numérica/);
});

test('template valida campos obrigatórios, faixas e campos desconhecidos',()=>{
  const template={schema:{fields:[
    {key:'dor',label:'Dor',type:'number',min:0,max:10},
    {key:'observacao',label:'Observação',type:'textarea',required:true},
  ]}};
  assert.deepEqual(validarConteudoTemplate(template,{dor:'4',observacao:'Paciente estável'}),{dor:4,observacao:'Paciente estável'});
  assert.throws(()=>validarConteudoTemplate(template,{dor:11,observacao:'x'}),/menor ou igual/);
  assert.throws(()=>validarConteudoTemplate(template,{dor:4}),/obrigatório/);
  assert.throws(()=>validarConteudoTemplate(template,{dor:4,observacao:'x',campoFantasma:'y'}),/não reconhecido/);
});
