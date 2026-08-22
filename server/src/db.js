import mongoose from 'mongoose'

export const connectDB = async (uri) => {
    mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB connecté')
    })
    mongoose.connection.on('error', (err) => {
        console.error('❌ Erreur MongoDB:', err.message)
    })

    await mongoose.connect(uri)
}
