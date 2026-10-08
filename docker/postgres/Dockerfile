# PostgreSQL de produção com o papel de menor privilégio do servidor.
#
# O script vai dentro da imagem, e não por volume, para não depender de a
# plataforma de deploy montar arquivos do repositório.
FROM postgres:17-alpine
COPY 10-papeis.sh /docker-entrypoint-initdb.d/10-papeis.sh
# Remove CR caso o arquivo venha de um checkout no Windows; sem isso o sh falha.
RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/10-papeis.sh \
 && chmod 755 /docker-entrypoint-initdb.d/10-papeis.sh
