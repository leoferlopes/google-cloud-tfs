// Copyright 2017 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as commonExecTypeDef from 'common/exec-options';
import * as mockery from 'mockery';
import {IMock, It, Mock, MockBehavior, Times} from 'typemoq';
import * as taskTypeDef from 'vsts-task-lib/task';
import * as trTypeDef from 'vsts-task-lib/toolrunner';

import * as gsutilTypeDef from '../gsutil-build-task';

describe('unit tests', () => {
  // Modules to import after mockery setup.
  let execOptions: typeof commonExecTypeDef;
  let gsutil: typeof gsutilTypeDef;
  let task: typeof taskTypeDef;

  // Mocks used in every test.
  let taskLibMock: IMock<typeof taskTypeDef>;
  let gsutilToolMock: IMock<trTypeDef.ToolRunner>;
  let endpointMock: IMock<commonExecTypeDef.Endpoint>;

  // Constants used by tests.
  const command = 'some command';
  const auth: taskTypeDef.EndpointAuthorization = {
    parameters : {certificate : '{"project_id": "projectId"}'},
    scheme : '',
  };
  const stdout = 'stdout';
  const stderr = 'stderr';

  // Inputs with defaults that can change in tests.
  let runOptions: gsutilTypeDef.RunGsutilOptions;
  let execResult: trTypeDef.IExecSyncResult;

  before('setup mockery', () => {
    /* tslint:disable no-require-imports */
    // ReSharper disable CommonJsExternalModule
    taskLibMock = Mock.ofInstance(require('vsts-task-lib/task'));
    taskLibMock.callBase = true;
    mockery.enable({
      useCleanCache : true,
      warnOnUnregistered : false,
    });
    mockery.registerMock('vsts-task-lib/task', taskLibMock.object);

    execOptions = require('common/exec-options');
    gsutil = require('../gsutil-build-task');
    task = require('vsts-task-lib/task');
    // ReSharper restore CommonJsExternalModule
    /* tslint:enable no-require-imports */
  });

  after('teardown mockery', (): void => {
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach('initialize mocks', () => {
    taskLibMock.reset();
    taskLibMock.callBase = true;
    taskLibMock.setup(t => t.getEndpointAuthorization(It.isAny(), It.isAny()))
        .returns(() => auth);
    taskLibMock.setup(t => t.setResult(It.isAny(), It.isAny()));

    endpointMock = Mock.ofType(execOptions.Endpoint, MockBehavior.Strict);
    endpointMock.setup(e => e.using(It.isAny())).callBase();
    endpointMock.setup(e => e.initCredentials());
    endpointMock.setup(e => e.clearCredentials());
    endpointMock.setup(e => e.projectParam).callBase();

    execResult = {
      stdout,
      stderr,
      error : null,
      code : 0,
    };

    gsutilToolMock =
        Mock.ofType<trTypeDef.ToolRunner>(null, MockBehavior.Strict);
    gsutilToolMock.setup(r => r.line(command))
        .returns(() => gsutilToolMock.object)
        .verifiable();
    gsutilToolMock.setup(r => r.arg(execOptions.Endpoint.credentialParam))
        .returns(() => gsutilToolMock.object)
        .verifiable();
    gsutilToolMock
        .setup(r => r.argIf(It.isAny(), endpointMock.object.projectParam))
        .returns(() => gsutilToolMock.object);
    gsutilToolMock.setup(t => t.execSync(It.isAny()))
        .returns(() => execResult)
        .verifiable();

    runOptions = {
      endpoint : endpointMock.object,
      gsutilTool : gsutilToolMock.object,
      command,
      includeProjectParam : false,
      ignoreReturnCode : false,
    };
  });

  it('should succeed with simple execution', () => {
    gsutil.runGsutil(runOptions);

    gsutilToolMock.verifyAll();
    taskLibMock.verifyAll();
    taskLibMock.verify(t => t.setResult(task.TaskResult.Succeeded, It.isAny()),
                       Times.once());
  });

  it('should succeed with execution of command that starts with gsutil', () => {
    runOptions.command = ` gsutil ${command} `;

    gsutil.runGsutil(runOptions);

    gsutilToolMock.verifyAll();
    taskLibMock.verifyAll();
    taskLibMock.verify(t => t.setResult(task.TaskResult.Succeeded, It.isAny()),
                       Times.once());
  });

  it('should succeed with execution of command that with gsutil in the middle',
     () => {
       runOptions.command = ` gsutil ${command} gsutil `;
       const cmdExpression = (r: trTypeDef.ToolRunner) =>
           r.line(`${command} gsutil`);
       gsutilToolMock.setup(cmdExpression).returns(() => gsutilToolMock.object);

       gsutil.runGsutil(runOptions);

       gsutilToolMock.verify(cmdExpression, Times.once());
       taskLibMock.verifyAll();
       taskLibMock.verify(
           t => t.setResult(task.TaskResult.Succeeded, It.isAny()),
           Times.once());
     });

  it('should fail on tool exception', () => {
    const errorMessage = 'Tested error.';
    execResult.error = {
      name : 'Testing',
      message : errorMessage,
    };

    gsutil.runGsutil(runOptions);

    gsutilToolMock.verifyAll();
    taskLibMock.verifyAll();
    taskLibMock.verify(t => t.setResult(task.TaskResult.Failed, errorMessage),
                       Times.once());
  });

  it('should fail on gsutil error return code', () => {
    execResult.code = -1;

    gsutil.runGsutil(runOptions);

    gsutilToolMock.verifyAll();
    taskLibMock.verifyAll();
    taskLibMock.verify(
        t => t.setResult(task.TaskResult.Failed, 'gsutil returned code -1'),
        Times.once());
  });

  it('should fail on gsutil error return code with no sdterr', () => {
    execResult.stderr = '';
    execResult.code = -1;

    gsutil.runGsutil(runOptions);

    gsutilToolMock.verifyAll();
    taskLibMock.verifyAll();
    taskLibMock.verify(
        t => t.setResult(task.TaskResult.Failed, 'gsutil returned code -1'),
        Times.once());
  });

  it('should succeed on gsutil error return code with ignoreReturnCode=true',
     () => {
       runOptions.ignoreReturnCode = true;
       execResult.code = -1;

       gsutil.runGsutil(runOptions);

       gsutilToolMock.verifyAll();
       taskLibMock.verifyAll();
       taskLibMock.verify(t => t.setResult(task.TaskResult.Succeeded,
                                           'gsutil returned code -1'),
                          Times.once());
     });

  it('should set variable', () => {
    const variableName = 'taskOutVariable';
    runOptions.outputVariable = variableName;
    taskLibMock.setup(t => t.setVariable(variableName, stdout)).verifiable();

    gsutil.runGsutil(runOptions);

    gsutilToolMock.verifyAll();
    taskLibMock.verifyAll();
    taskLibMock.verify(
        t => t.setResult(task.TaskResult.Succeeded, 'gsutil returned code 0'),
        Times.once());
  });

  it('should not include project param', () => {
    runOptions.includeProjectParam = false;

    gsutil.runGsutil(runOptions);

    gsutilToolMock.verifyAll();
    taskLibMock.verifyAll();
    gsutilToolMock.verify(r => r.argIf(false, It.isAny()), Times.once());
    taskLibMock.verify(
        t => t.setResult(task.TaskResult.Succeeded, 'gsutil returned code 0'),
        Times.once());
  });

  it('should include project param', () => {
    runOptions.includeProjectParam = true;

    gsutil.runGsutil(runOptions);
    gsutilToolMock.verifyAll();
    taskLibMock.verifyAll();
    gsutilToolMock.verify(r => r.argIf(true, It.isAny()), Times.once());
    taskLibMock.verify(
        t => t.setResult(task.TaskResult.Succeeded, 'gsutil returned code 0'),
        Times.once());
  });
});
