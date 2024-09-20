import express from 'express';
import Database from 'better-sqlite3';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  return res.status(200).send({'message': 'SHIPTIVITY API. Read documentation to see API docs'});
});

// We are keeping one connection alive for the rest of the life application for simplicity
const db = new Database('./clients.db');

// Don't forget to close connection when server gets terminated
const closeDb = () => db.close();
process.on('SIGTERM', closeDb);
process.on('SIGINT', closeDb);

/**
 * Validate id input
 * @param {any} id
 */
const validateId = (id) => {
  if (Number.isNaN(id)) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid id provided.',
      'long_message': 'Id can only be integer.',
      },
    };
  }
  const client = db.prepare('select * from clients where id = ? limit 1').get(id);
  if (!client) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid id provided.',
      'long_message': 'Cannot find client with that id.',
      },
    };
  }
  return {
    valid: true,
  };
}

/**
 * Validate priority input
 * @param {any} priority
 */
const validatePriority = (priority) => {
  if (Number.isNaN(priority)) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid priority provided.',
      'long_message': 'Priority can only be positive integer.',
      },
    };
  }
  return {
    valid: true,
  }
}

/**
 * Get all of the clients. Optional filter 'status'
 * GET /api/v1/clients?status={status} - list all clients, optional parameter status: 'backlog' | 'in-progress' | 'complete'
 */
app.get('/api/v1/clients', (req, res) => {
  const status = req.query.status;
  if (status) {
    // status can only be either 'backlog' | 'in-progress' | 'complete'
    if (status !== 'backlog' && status !== 'in-progress' && status !== 'complete') {
      return res.status(400).send({
        'message': 'Invalid status provided.',
        'long_message': 'Status can only be one of the following: [backlog | in-progress | complete].',
      });
    }
    const clients = db.prepare('select * from clients where status = ?').all(status);
    return res.status(200).send(clients);
  }
  const statement = db.prepare('select * from clients');
  const clients = statement.all();
  return res.status(200).send(clients);
});

/**
 * Get a client based on the id provided.
 * GET /api/v1/clients/{client_id} - get client by id
 */
app.get('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id , 10);
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    res.status(400).send(messageObj);
  }
  return res.status(200).send(db.prepare('select * from clients where id = ?').get(id));
});

/**
 * Update client information based on the parameters provided.
 * When status is provided, the client status will be changed
 * When priority is provided, the client priority will be changed with the rest of the clients accordingly
 * Note that priority = 1 means it has the highest priority (should be on top of the swimlane).
 * No client on the same status should not have the same priority.
 * This API should return list of clients on success
 *
 * PUT /api/v1/clients/{client_id} - change the status of a client
 *    Data:
 *      status (optional): 'backlog' | 'in-progress' | 'complete',
 *      priority (optional): integer,
 *
 */

/* ---------- Update code below ----------*/


app.put('/api/v1/clients/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { valid, messageObj } = validateId(id);
    if (!valid) {
      return res.status(400).send(messageObj);
    }

    let { status, priority } = req.body;

    // Validate status
    if (status && !['backlog', 'in-progress', 'complete'].includes(status)) {
      return res.status(400).send({
        message: 'Invalid status provided.',
        long_message: 'Status can only be one of the following: backlog, in-progress, complete.',
      });
    }

    // Validate priority
    if (priority) {
      const priorityValidation = validatePriority(priority);
      if (priority && !priorityValidation.valid) {
        return res.status(400).send(priorityValidation.messageObj);
      }
    }

    // Update client
    if (status) {
      db.prepare('UPDATE clients SET status = ? WHERE id = ?').run(status, id);
    }
   

      // Update client priority or assign lowest priority if not provided
      if (!priority) {
        const maxPriority = db.prepare('SELECT MAX(priority) FROM clients WHERE status = ?').get(status);
        priority = maxPriority ? maxPriority.maxPriority + 1 : 1;
      }
      db.prepare('UPDATE clients SET priority = ? WHERE id = ?').run(priority, id);
  
      // Reorder priorities for clients with same status
      const clientsWithSameStatus = db.prepare('SELECT * FROM clients WHERE status = ?').all(status);
      clientsWithSameStatus.sort((a, b) => a.priority - b.priority);
      clientsWithSameStatus.forEach((client, index) => {
        db.prepare('UPDATE clients SET priority = ? WHERE id = ?').run(index + 1, client.id);
      });

    // Return updated clients
    const updatedClients = db.prepare('SELECT * FROM clients').all();
    return res.status(200).send(updatedClients);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: 'Internal Server Error' });
  }
});
  
  



app.listen(3000);
console.log('app running on port ', 3000);
