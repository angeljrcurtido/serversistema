const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { exec } = require('child_process');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 8000;

// Agregar CORS a la aplicación
app.use(cors({
  credentials: true,
  origin: '*'

}))
// Obtener la cadena de conexión desde las variables de entorno
const MONGODB_URI = process.env.MONGODB_URI;


// Definir esquema de Categoría
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  subcategories: [String]
});

const Category = mongoose.model('Category', categorySchema);


//Definir esquema para autores
const authorSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
});

const Author = mongoose.model('Author', authorSchema);

// Definir el esquema para el modelo de usuario
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },

  cargo: {
    type: String,
  }
});



app.use(bodyParser.json());

// Definir un esquema para los libros
const bookSchema = new mongoose.Schema({
  titulo: String,
  codigodelibro: String,
  categoria: String,
  imagen: String,
  autor: String,
  subcategoria: String,
  descripcion: String,
  cantidad: Number,
  alquilados: [
    {
      nombreLibro: String,
      codigolibro: String,
      nombrePersona: String,
      apellidoPersona: String,
      telefonoPersona: String,
      edad: Number,
      fechaRetiro: Date,
      fechaDevolucion: Date,
      cantidadAlquilada: Number,
      estado: { type: String, default: 'prestado' },
    },
  ],
});

const Book = mongoose.model('Book', bookSchema);

app.use(bodyParser.json());

// Ruta para editar un autor por su ID
app.put('/autores/:id', async (req, res) => {
  try {
    const autorId = req.params.id;
    const { nombre } = req.body;
    const autorActualizado = await Author.findByIdAndUpdate(autorId, { nombre }, { new: true });
    res.status(200).json(autorActualizado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Ruta para agregar un nuevo autor 
app.post('/autores', async (req, res) => {
  try {
    const { nombre } = req.body;
    const newAuthor = new Author({ nombre });
    await newAuthor.save();
    res.status(201).json(newAuthor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Ruta para eliminar un autor por su ID
app.delete('/autores/:id', async (req, res) => {
  try {
    const autorId = req.params.id;
    await Author.findByIdAndDelete(autorId);
    res.status(200).json({ message: 'Autor eliminado exitosamente' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Ruta para obtener todos los autores
app.get('/autores', async (req, res) => {
  try {
    const autores = await Author.find();
    res.status(200).json(autores);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ruta para agregar una nueva categoría
app.post('/categories', async (req, res) => {
  try {
    const { name, subcategories } = req.body;
    const newCategory = new Category({ name, subcategories });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Ruta para llamar a una subcategoria por la id de la categoria
app.get('/categories/:name/subcategories', async (req, res) => {
  try {
    const { name } = req.params;
    const category = await Category.findOne({ name });

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    res.status(200).json(category.subcategories);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Aqui empieza para usuarios login y registros:

// Método para comparar la contraseña
userSchema.methods.comparePassword = async function (password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    throw new Error(error);
  }
};

// Método para generar un token de autenticación
userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign({ userId: this._id }, 'secretKey', { expiresIn: '1h' });
  return token;
};

// Antes de guardar el usuario, cifra la contraseña
userSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }
    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
    next();
  } catch (error) {
    return next(error);
  }
});
// Crear el modelo de usuario utilizando el esquema definido
const User = mongoose.model('User', userSchema);

// Ruta para el registro de usuarios
app.post('/register', async (req, res) => {
  try {
    const { username, email, password, cargo } = req.body;

    // Verificar si el usuario ya existe en la base de datos
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'El usuario ya existe' });
    }

    // Crear un nuevo usuario
    const newUser = new User({ username, email, password, cargo });
    await newUser.save();

    res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Ruta para el inicio de sesión de usuarios
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verificar si el usuario existe en la base de datos
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Verificar la contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Generar un token de autenticación
    const token = user.generateAuthToken();

    // Incluir el atributo cargo en la respuesta
    const cargo = user.cargo; // Asegúrate de que el modelo de usuario tenga un campo 'cargo'

    res.status(200).json({ token, cargo }); // Enviar el cargo junto con el token
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Ruta para obtener todas las categorías
app.get('/login', async (req, res) => {
  try {
    const user = await User.find();
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ruta para editar un usuario
app.put('/usuario/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, cargo } = req.body;

    const updatedData = { username, email, cargo };
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updatedData.password = hashedPassword;
    }

    const updatedUser = await User.findByIdAndUpdate(id, updatedData, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ruta para eliminar un usuario
app.delete('/usuario/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Editar una subcategoría por su índice
app.put('/categories/:id/subcategorieseditar', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Obtener el índice de la subcategoría a editar
    const indexToEdit = req.body.subcategoryIndex;

    // Editar la subcategoría en ese índice
    category.subcategories[indexToEdit] = req.body.newSubcategory;

    await category.save();
    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});



// Eliminar subcategorías de una categoría
app.put('/categories/:id/subcategories', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Obtener el índice de la subcategoría a eliminar
    const indexToRemove = req.body.subcategoryIndex;

    // Eliminar la subcategoría en ese índice
    category.subcategories.splice(indexToRemove, 1);

    await category.save();
    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Para estirar una categoria por su id
app.get('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Eliminar categoria por id 
app.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    res.status(200).json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Actualizar nombre de una categoría
app.patch('/categories/:id/name', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    category.name = req.body.name;
    await category.save();
    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Agregar mas subcategorias a la categoria seleccionada por su id
app.patch('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    if (!category.subcategories) {
      category.subcategories = [];
    }

    category.subcategories.push(req.body.subcategory);

    await category.save();
    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Ruta para obtener todas las categorías
app.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Ruta para agregar un nuevo libro =========////
app.post('/libros', async (req, res) => {
  try {
    const { titulo, codigodelibro, categoria, imagen, autor, subcategoria, descripcion, cantidad } = req.body;
    const newBook = new Book({ titulo, codigodelibro, categoria, imagen, autor, subcategoria, descripcion, cantidad });
    await newBook.save();
    res.status(201).json(newBook);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Ruta para obtener todos los libros
app.get('/libros', async (req, res) => {
  try {
    const libros = await Book.find();
    res.status(200).json(libros);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ruta para obtener todos los libros
app.get('/libros/count', async (req, res) => {
  try {
    const count = await Book.countDocuments();
    res.status(200).json({ totalLibros: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ruta para alquilar libros
app.post('/libros/alquilar', async (req, res) => {
  try {
    const { titulo, nombreLibro, codigolibro, nombrePersona, apellidoPersona, telefonoPersona, edad, cantidadAlquilada, fechaRetiro, fechaDevolucion } = req.body;
    const book = await Book.findOne({ titulo });

    if (!book) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }

    if (book.cantidad < cantidadAlquilada) {
      return res.status(400).json({ message: 'No hay suficientes copias disponibles para alquilar' });
    }

    const newRental = {
      nombreLibro,
      codigolibro,
      nombrePersona,
      apellidoPersona,
      telefonoPersona,
      edad,
      fechaRetiro,
      fechaDevolucion,
      cantidadAlquilada,
    };

    book.alquilados.push(newRental);
    book.cantidad -= cantidadAlquilada;

    await book.save();

    res.status(201).json(book);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});



// Manejo de libros devueltos y no devueltos
app.patch('/libros/devolver/:alquilerId', async (req, res) => {
  try {
    const { alquilerId } = req.params;
    const book = await Book.findOne({ 'alquilados._id': alquilerId });

    if (!book) {
      return res.status(404).json({ message: 'Alquiler no encontrado' });
    }

    const alquiler = book.alquilados.find(a => a._id.toString() === alquilerId);

    if (!alquiler) {
      return res.status(404).json({ message: 'Alquiler no encontrado' });
    }

    if (alquiler.estado === 'devuelto') {
      return res.status(400).json({ message: 'Este alquiler ya ha sido devuelto' });
    }

    alquiler.estado = 'devuelto';
    book.cantidad += alquiler.cantidadAlquilada;

    await book.save();

    res.status(200).json(book);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Editar Libros basados en su id
app.put('/libros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBook = await Book.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedBook) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }

    res.status(200).json(updatedBook);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Eliminar un libro por su id
app.delete('/libros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBook = await Book.findByIdAndRemove(id);

    if (!deletedBook) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }

    res.status(200).json({ message: 'Libro eliminado exitosamente' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Ruta para obtener solo los datos de los alquilados
app.get('/libros/alquilados', async (req, res) => {
  try {
    const librosAlquilados = await Book.find();
    const alquilados = librosAlquilados.flatMap(libro => libro.alquilados);
    res.status(200).json(alquilados);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ruta para obtener solo los alquilados con estado "prestado"
app.get('/libros/alquilados/prestados', async (req, res) => {
  try {
    const librosAlquilados = await Book.find();
    const alquiladosPrestados = librosAlquilados.flatMap(libro => libro.alquilados.filter(alquilado => alquilado.estado === 'prestado'));
    res.status(200).json(alquiladosPrestados);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Ruta para obtener la cantidad de libros prestados por fecha de retiro
app.get('/libros/prestados/por-fecha-retiro', async (req, res) => {
  try {
    // Obtener todos los libros prestados
    const librosPrestados = await Book.find({ 'alquilados.estado': 'prestado' });

    // Crear un objeto para almacenar la cantidad de libros prestados por fecha de retiro
    const librosPorFechaRetiro = {};

    // Iterar sobre los libros prestados y contar por fecha de retiro
    librosPrestados.forEach(libro => {
      libro.alquilados.forEach(alquilado => {
        if (alquilado.fechaRetiro instanceof Date) {
          const fechaRetiro = alquilado.fechaRetiro.toISOString().split('T')[0]; // Obtener solo la fecha (sin la hora)
          if (librosPorFechaRetiro[fechaRetiro]) {
            librosPorFechaRetiro[fechaRetiro]++;
          } else {
            librosPorFechaRetiro[fechaRetiro] = 1;
          }
        }
      });
    });

    res.status(200).json(librosPorFechaRetiro);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Obtener un libro por su id
app.get('/libros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const libro = await Book.findById(id);

    if (!libro) {
      return res.status(404).json({ message: 'Libro no encontrado' });
    }

    res.status(200).json(libro);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Conectar a la base de datos MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Conexión a MongoDB Atlas exitosa'))
  .catch(err => console.error('Error de conexión a MongoDB Atlas', err));
module.exports = app;
app.listen(3001, () => {
  console.log('Servidor corriendo en el puerto 3001');
});