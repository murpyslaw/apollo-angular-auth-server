/////////////////////////
// Import node modules //
/////////////////////////

// General
import * as color from 'chalk';
import * as logger from 'morgan';
import * as localAuth from 'passport-local';
import * as postReqParser from 'body-parser';
import * as express from 'express';
import * as rethink from 'rethinkdb';
import * as _ from 'lodash';
import * as dash from 'rethinkdbdash';
import * as cors from 'cors';
import * as timeout from 'connect-timeout';

const PORT = (process.env.PORT || 3000) as number;
const DB_HOST = "localhost";
const DB_PORT = 28015;
//const DB_URL = DB_HOST + DB_PORT;
const DB_NAME = "ctehr_compute_db";
const DB_ROOT_URL = "/";
let DB_CONNECTION = null;

//////////////////////////
// Database - RethinkDB //
//////////////////////////

rethink.connect({                                                                       // Connect to rethinkDB on DB_HOST:DB_PORT
//    db: DB_NAME,
    host: DB_HOST,
    port: DB_PORT,
    timeout: 360,
//    user: 'admin',
//    password: ''
}).then((dbConn) => {                                                                    // Create DB tables if they don't exist
    DB_CONNECTION = dbConn;
    rethink.dbList()
    .run(dbConn, (err, listResults) => {
        if (!_.includes(listResults, DB_NAME)) {                                          // If the database does not exist
            rethink.dbCreate(DB_NAME)                                                     // Create a new db with DB_NAME
            .run(dbConn, (err, createResult) => {
                if (err) throw err;
                if (createResult) {
                    console.log(color.cyan("DB: " + "created new DATABASE ------- " + DB_NAME));
                    dbInstance.tableList()
                    .run(dbConn, (err, listResults) => {
                        if (!_.includes(listResults, "users")) {
                            dbInstance.tableCreate("users").run(dbConn, (err, createResult) => {
                                if (err) throw err;
                                if (createResult)
                                    console.log(color.cyan("DB: " + "created new TABLE ------- " + "users"));
                            });
                        }
                    });
                    }
                }
            );
        }
    });
});

// Create instance of the DB
let dbInstance = rethink.db(DB_NAME);

////////////
// Apollo //
////////////
import RethinkDBDashDriver from 'apollo-passport-rethinkdbdash';
import { graphqlExpress as apolloServer } from 'apollo-server-express';
import apolloPass from 'apollo-passport';

const dashRethink = dash({
    db: DB_NAME,
    servers: [
        {
            DB_HOST,
            DB_PORT
        }
    ]
})
const apolloAuth = new apolloPass({
    db: new RethinkDBDashDriver(dashRethink),
    jwtSecret: 'keyboard-cat',
    authPath: '/api/auth',
    ROOT_URL: DB_ROOT_URL
});
apolloAuth.use('local', localAuth);

import * as dotenv from 'dotenv';
dotenv.config();

////////////////////////
// Express Web Server //
////////////////////////

// Initialize the Express application
const server: express.Application = express();

// Serve angular app
const apolloSvrOptions = {
    schema: apolloAuth.schema(),
    resolvers: apolloAuth.resolvers()
}

//////////
// cors //
//////////
server.use(cors({
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
        'content-type', 
        'authorization',
        'content-length',
        'x-requested-with', 
        'accept',
        'origin' 
    ],
    credentials: true,
    origin: '*'
}));

/////////
// api //
/////////
server.use('/api',
    logger('combined'),
    postReqParser.json(),
    apolloServer( apolloAuth.wrapOptions(apolloSvrOptions) )
);

server.use('/api/auth', apolloAuth.expressMiddleware());

// Start listening for HTTP requests
server.listen(PORT, '127.0.0.1', function(): void {
    console.log('API Server listening on port: ' + PORT);
});