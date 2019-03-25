# ![GCP][GCPLogo] Gsutil Command Line Build Task

Execute an arbitrary [gsutil][gsutil] command.

## Usage

This task allow you to execute any gsutil command, giving access to any functionalty missing from the more specialized
build tasks.

## Parameters

![Gsutil Command Line Build Task Inputs][gsutil-inputs]

 - GCP connection:
   The service endpoint defining the GCP project and service account for gsutil to authenticate against.
 - Command Line: The [gsutil command][gsutil] to run and its arguments.
 - Add project parameter: Include the `-p <project-id>` parameter in the command line,
   taking the project id from the GCP connection. Leave unchecked to supply your own `-p` parameter in the
   Command Line.
 - Ignore Return Code: Check this to allow the task to succeed even if gsutil reports a failure.
 - StdOut build variable: The name of a build variable in which the output from gsutil is saved.

 [GCPLogo]: ../images/cloud_64x64.png
 [gsutil-inputs]: ../images/screenshots/gsutil-inputs.png

 [gsutil]: https://cloud.google.com/storage/docs/gsutil/
