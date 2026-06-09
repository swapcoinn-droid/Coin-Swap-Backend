import { loadEnvFile } from 'node:process';

if (process.env.NODE_ENV !== 'production') {
    loadEnvFile(".env");
}

const { default: app } = await import('./app.js');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
