# Database Migrations

In the hopefully unlikely event that a schema change more complex than the simple addition of a column to a database migration is necessary, a migration must be written.

Migrations are applied by the `Migrator` at startup.

The `Migrator` creates a backup of each database prior to running any migrations, and if an exception is thrown at any time during the process the `Migrator` will revert to these backups automatically. The backup files are left in place when the migration is complete so that users can manually revert if the migration left their application in a bad state or destroyed or lost data.

## Creating a Migration

Each migration must be created as a class that implements the `IMigration` interface. The naming convention for migration classes is:

```
Z<MMDDYYYY>_<ShortDescription>Migration
```

Migrations MUST:

- Be idempotent. The migration must be able to be run any number of times without corrupting the database or losing data.
- Inspect the target database(s) schema to determine whether the migration needs to be applied (if possible)
- Use transactions when performing database operations and using/try catch where appropriate to avoid partially applied migrations.
- Figure out where on disk the associated database(s) are located. This is accomplished by combining the static `Program.DataDirectory` variable
  and the name(s) of the table(s) that need to be migrated.
- Log progress (with logs prefixed by >), so users can see that the application is performing work while records are updated.

Review the `IMigration` interface to determine implementation details.

The new `IMigration` implementation must be added to the dictionary in the `Migrations` property of the `Migrator` in the desired order so that it can be run.

### Above all else, each and every migration **MUST** be idempotent; they'll be evaluated and run each time the app starts.
