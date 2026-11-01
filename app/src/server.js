import app from './app.js';
import { migrate } from './db.js';

await migrate();
const port = process.env.APP_PORT ?? 3000;
const host = process.env.HOST ?? '127.0.0.1'; // containers set HOST=0.0.0.0
app.listen(port, host, () => console.log(`app listening on http://${host}:${port}`));
