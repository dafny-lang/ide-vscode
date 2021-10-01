import { ExtensionContext, ProviderResult, ShellExecution, Task, TaskDefinition, TaskGroup, TaskProvider, tasks, TaskScope } from 'vscode';

interface IBuildTaskDefinition extends TaskDefinition {
  args: string[];
}

export default class CompileTaskProvider implements TaskProvider {
  private constructor() {}

  public static createAndRegister(context: ExtensionContext): CompileTaskProvider {
    const provider = new CompileTaskProvider();
    context.subscriptions.push(tasks.registerTaskProvider('compile', provider));
    return provider;
  }

  public provideTasks(): ProviderResult<Task[]> {
    return [ this.createCompileAndRunTask() ];
  }

  private createCompileAndRunTask(): Task {
    const definition: IBuildTaskDefinition = {
      type: 'compile',
      args: [
        '${file}',
        '/compile:1',
        '/verifyAllModules',
        '/spillTargetCode:1',
        '/out:${workspaceFolder}/out/${fileBasenameNoExtension}.dll'
      ]
    };
    const args = definition.args.join(' ');
    const task = new Task(
      definition,
      TaskScope.Workspace,
      'Current document',
      'compile',
      new ShellExecution(`dotnet Dafny.dll ${args}`)
    );
    task.group = TaskGroup.Build;
    // task.group = TaskGroup.
    return task;
  }

  public resolveTask(task: Task): ProviderResult<Task> {
    return task;
  }
}
