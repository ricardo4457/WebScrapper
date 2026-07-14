# Usamos uma imagem oficial e leve do Node.js
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os ficheiros de dependências
COPY package*.json ./

# Instala as dependências do teu projeto
RUN npm install

# Copia todo o código do projeto para o container
COPY . .

# Expõe a porta que a API do Express usa
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "src/app.js"]