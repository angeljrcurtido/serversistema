 
# Establece la imagen base
   FROM node:14

   # Establece el directorio de trabajo
   WORKDIR /app

   # Copia los archivos de package.json y package-lock.json
   COPY package*.json ./

   # Instala las dependencias
   RUN npm install

   # Copia el resto de los archivos del proyecto
   COPY . .

   # Establece el comando de inicio
   CMD ["npx", "nodemon", "server.js"]
