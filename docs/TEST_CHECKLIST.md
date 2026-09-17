# Checklist de validação — Hospital PRJT MVP

## 1. Autenticação e permissões
- [ ] Login admin funciona.
- [ ] Senha incorreta retorna 401.
- [ ] Usuário inativo não autentica.
- [ ] Usuário sem `write` recebe 403 em operação de escrita.
- [ ] ADMIN possui override das permissões.

## 2. Pacientes
- [ ] Cadastro com prontuário, nome e nascimento.
- [ ] Prontuário duplicado é recusado.
- [ ] CPF inválido é recusado.
- [ ] Busca por nome/prontuário/CPF.
- [ ] Dados aparecem automaticamente ao selecionar paciente em internação.

## 3. Leitos
- [ ] Cadastro de leito.
- [ ] Grid agrupa visualmente status.
- [ ] LIVRE/OCUPADO não são editados manualmente.
- [ ] Bloqueio, manutenção e reserva exigem motivo.
- [ ] Leito ocupado não pode ser bloqueado.
- [ ] Liberar bloqueio retorna a LIVRE quando não existe internação ativa.

## 4. Internação e alta
- [ ] Nova internação aceita paciente + leito + data/observação.
- [ ] Leito muda para OCUPADO na mesma transação.
- [ ] Paciente com internação ativa não pode ser internado novamente.
- [ ] Leito não-LIVRE é recusado.
- [ ] Paciente com precaução ISOLAMENTO só entra em leito ISOLAMENTO.
- [ ] Previsão de alta anterior à entrada é recusada.
- [ ] LOS calculado é coerente.
- [ ] Alta finaliza internação e libera leito na mesma transação.
- [ ] Data de alta anterior à internação é recusada.

## 5. Outputs
- [ ] Dashboard não possui edição manual.
- [ ] Taxa de ocupação, livres, ocupados e internações ativas batem com o banco.
- [ ] Alterar internação/alta invalida o cache do Dashboard.
- [ ] TV exibe apenas número, andar, tipo e status.
- [ ] TV atualiza a cada 30s.
- [ ] Nenhum dado de paciente aparece no Modo TV.

## 6. Prontuário
- [ ] Médico gera evolução MEDICA automaticamente.
- [ ] Enfermeiro gera evolução ENFERMAGEM automaticamente.
- [ ] Outros cargos geram MULTIPROFISSIONAL.
- [ ] Autor/data são preenchidos automaticamente.
- [ ] Usuário comum não edita evolução de outro autor.
- [ ] Admin consegue editar.

## 7. Profissionais e escala
- [ ] Cadastro e inativação de profissional.
- [ ] Profissional inativo não pode ser escalado.
- [ ] Dois profissionais diferentes podem estar no mesmo turno/data.
- [ ] O mesmo profissional não pode ser duplicado no mesmo turno/data.

## 8. Excel
- [ ] Preview acusa ausência de campos obrigatórios.
- [ ] Preview acusa CPF inválido.
- [ ] Importação não ocorre se preview possui erro.
- [ ] Paciente existente por prontuário é atualizado.
- [ ] Leito existente por número é atualizado sem sobrescrever status operacional.
- [ ] Exportação abre corretamente no Excel/LibreOffice.
- [ ] Log da importação é persistido.

## 9. Backup
- [ ] Backup manual gera `.sql.gz`.
- [ ] Backup é listável e baixável.
- [ ] Restore funciona em ambiente de homologação.
- [ ] Cron executa às 00:00/06:00/12:00/18:00.
- [ ] Arquivos locais > 7 dias são removidos.
- [ ] Se S3 configurado, upload e retenção de 30 dias funcionam.

## 10. Concorrência
- [ ] Duas requisições simultâneas tentando o mesmo leito não devem resultar em duas internações ativas.
- [ ] Duas altas simultâneas da mesma internação não devem produzir estado inválido.
- [ ] Testar 10–50 usuários simultâneos, conforme contexto operacional documentado.

> Atenção: o código usa transações para atualização conjunta de internação/leito, mas a bateria de concorrência deve validar comportamento sob disputa real no PostgreSQL.
