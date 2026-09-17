# API — resumo

Base: `/api`

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/tv`
- `GET|POST /pacientes`
- `GET|PUT|DELETE /pacientes/:id`
- `GET|POST /leitos`
- `GET /leitos/disponiveis`
- `PUT|DELETE /leitos/:id`
- `POST /leitos/:id/bloquear`
- `POST /leitos/:id/liberar`
- `GET|POST /internacoes`
- `PUT /internacoes/:id/finalizar`
- `GET /dashboard/indicadores`
- `GET /dashboard/ocupacao-7dias`
- `GET /tv/leitos`
- `GET|POST /profissionais`
- `PUT|DELETE /profissionais/:id`
- `GET|POST /escala`
- `DELETE /escala/:id`
- `GET /prontuario/paciente/:pacienteId`
- `POST /prontuario/paciente/:pacienteId`
- `PUT /prontuario/:id`
- `GET|POST /usuarios`
- `PUT|DELETE /usuarios/:id`
- `POST /sync/preview`
- `POST /sync/importar`
- `GET /sync/exportar?tipo=TODOS`
- `GET /backups`
- `POST /backups/manual`
- `GET /backups/:file/download`
- `POST /backups/:file/restore`
