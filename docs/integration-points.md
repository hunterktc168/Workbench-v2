# Integration Points
Ledger requires a 'dossier' store in db.js to persist commitments and deltas.
Decision: Add a dedicated 'dossier' store, rather than overloading 'sessions'.
