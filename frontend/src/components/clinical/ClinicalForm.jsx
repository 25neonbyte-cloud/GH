function Field({field,value,inherited,onChange}) {
  const common = {
    className: 'input',
    value: value ?? '',
    onChange: e => onChange(field.key, e.target.value),
  };

  return <label className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
    <span className="label">
      {field.label}{field.required ? ' *' : ''}
      {inherited && <span className="ml-2 text-amber-600 font-semibold" title="Valor herdado da evolução anterior; confirme ou atualize">* herdado</span>}
    </span>
    {field.type === 'textarea'
      ? <textarea {...common} rows="3"/>
      : field.type === 'select'
        ? <select {...common}><option value="">Selecione</option>{(field.options||[]).map(option=><option key={option} value={option}>{option}</option>)}</select>
        : <input {...common} type={field.type === 'number' ? 'number' : 'text'} min={field.min} max={field.max} step={field.type === 'number' ? 'any' : undefined}/>}
  </label>;
}

export default function ClinicalForm({template,values,inherited=[],onChange}) {
  if(!template) return null;
  const fields = new Map((template.schema?.fields||[]).map(field=>[field.key,field]));
  const sections = template.interface?.sections?.length
    ? template.interface.sections
    : [{title:template.nome,fields:[...fields.keys()]}];

  return <div className="space-y-4">
    {sections.map(section=><div key={section.title} className="border rounded-xl p-4">
      <h3 className="font-bold mb-3">{section.title}</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {(section.fields||[]).map(key=>{
          const field=fields.get(key);
          return field?<Field key={key} field={field} value={values?.[key]} inherited={inherited.includes(key)} onChange={onChange}/>:null;
        })}
      </div>
    </div>)}
  </div>;
}
