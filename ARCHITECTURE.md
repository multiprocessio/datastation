# Architecture

DataStation has three modes: browser, desktop, and server. Browser
panel eval happens in-browser. Desktop and server panel eval happen on
the desktop or server. Each panel's eval has logic that decides
whether to evaluate the panel in-memory or to pass over RPC to the
backend (the desktop or server process).

Desktop RPC happens through Node's builtin RPC and Server RPC happens
over HTTP. RPC logic from the UI is defined in ui/asyncRPC.ts and also
desktop/preload.ts (for some Electron RPC helpers on desktop only).

The results of panel evals are kept only on disk. Only metadata
(preview, shape, size, etc.) from panel evals are returned in RPC.

## ./desktop

This directory contains the Electron app and code that runs RPC
calls. It loads the entire UI bundle and responds to RPC requests from
it.

### ./desktop/project.ts

All state in the desktop app is stored in JSON files on disk at the
moment. The result of panel evals is stored on disk.

It might be ideal to store state in a database (especially for the
server use case) but that complicates the install for all supported
languages that would then depend not just on a JSON library but also
on a database library. Still, this may be the right way to go at the
same time as making language setup easier by providing a button or
something to install all missing dependencies.

### ./desktop/panel

NOTE: This code is being migrated to Go. All panel types except for a
few database vendors have been ported to Go. A number of Node panel
handlers have been deleted since they are no longer used.

This is where eval handlers for each panel type (program, database,
etc.) are defined.

All database-specific handlers are defined in
./desktop/panel/databases/*.ts since there are so many of them.

Evaluation happens by spawning a Node.js subprocess where all the eval
handlers are actually run. ./desktop/runner.ts is the entrypoint for
this on desktop. ./server/runner.ts is the equivalent on the server.

This allows easy resource cleanup and easy "kill" panel eval support.

## ./runner

This is where the Go port of the original Node.js panel eval code is.

## ./server

This directory contains the server (Express) app and code that proxies
RPC calls over HTTP to "desktop" implementations. Really, the code is
just located in the ./desktop/panel/ directory but it is run in/by the
server process at the moment.

All state in the server app is stored in PostgreSQL. The result of
panel evals is still stored on disk however. So it isn't currently
possible to run more than one instance of the server without something
like sticky sessions.

## ./ui

This contains the in-browser UI that makes RPC calls to handle project
state and panel evals.

### ./ui/asyncRPC.ts

This contains the code the client uses to make RPC calls to either the
desktop process or the server process.

### ./ui/panels

This is where all logic for each panel is contained. If you wanted to
add a new panel type, you could copy an existing panel and register it
in ./ui/panels/index.ts. You would also need to declare it in
./shared/state.ts.

### ./ui/connectors

This is where all data connectors are defined. If you wanted to add a
new connector, you could copy an existing connector and register it in
./ui/connectors/index.ts. You would also need to declare it in
./shared/state.ts.

## ./shared

This contains helper utilities used all over the place.

### ./shared/state.ts

This is where types for all entities in state are described. Any time
you want to add a new panel or connector, etc. you'll need to add it
here.

### ./shared/languages

This is where all supported languages are defined and where their
libraries for interacting with DataStation are defined.
