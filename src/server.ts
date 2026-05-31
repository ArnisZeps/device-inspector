import 'dotenv/config';
import app from './app';
import * as probeWorker from './workers/probeWorker';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  probeWorker.start();
});
