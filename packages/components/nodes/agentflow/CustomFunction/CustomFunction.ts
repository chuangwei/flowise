import { DataSource } from 'typeorm'
import {
    ICommonObject,
    IDatabaseEntity,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeParams,
    IServerSideEventStreamer
} from '../../../src/Interface'
import { getVars, executeJavaScriptCode, createCodeExecutionSandbox } from '../../../src/utils'
import { updateFlowState } from '../utils'

interface ICustomFunctionInputVariables {
    variableName: string
    variableValue: string
}

const exampleFunc = `/*
* 您可以使用在Flowise中导入的任何库
* 您可以使用在输入变量中指定的属性，前缀为$。例如：$foo
* 您可以获取默认流配置：$flow.sessionId、$flow.chatId、$flow.chatflowId、$flow.input、$flow.state
* 您可以获取全局变量：$vars.<变量名>
* 在函数末尾必须返回一个字符串值
*/

const fetch = require('node-fetch');
const url = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true';
const options = {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};
try {
    const response = await fetch(url, options);
    const text = await response.text();
    return text;
} catch (error) {
    console.error(error);
    return '';
}`

class CustomFunction_Agentflow implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    color: string
    hideOutput: boolean
    hint: string
    baseClasses: string[]
    documentation?: string
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = '自定义函数'
        this.name = 'customFunctionAgentflow'
        this.version = 1.0
        this.type = 'CustomFunction'
        this.category = 'Agent Flows'
        this.description = '执行自定义函数'
        this.baseClasses = [this.type]
        this.color = '#E4B7FF'
        this.inputs = [
            {
                label: '输入变量',
                name: 'customFunctionInputVariables',
                description: '输入变量可在函数中使用，前缀为$。例如：$foo',
                type: 'array',
                optional: true,
                acceptVariable: true,
                array: [
                    {
                        label: '变量名',
                        name: 'variableName',
                        type: 'string'
                    },
                    {
                        label: '变量值',
                        name: 'variableValue',
                        type: 'string',
                        acceptVariable: true
                    }
                ]
            },
            {
                label: 'JavaScript函数',
                name: 'customFunctionJavascriptFunction',
                type: 'code',
                codeExample: exampleFunc,
                description: '要执行的函数。必须返回一个字符串或可以转换为字符串的对象。'
            },
            {
                label: '更新工作流状态',
                name: 'customFunctionUpdateState',
                description: '在工作流执行期间更新运行状态',
                type: 'array',
                optional: true,
                acceptVariable: true,
                array: [
                    {
                        label: '键',
                        name: 'key',
                        type: 'asyncOptions',
                        loadMethod: 'listRuntimeStateKeys',
                        freeSolo: true
                    },
                    {
                        label: '值',
                        name: 'value',
                        type: 'string',
                        acceptVariable: true,
                        acceptNodeOutputAsVariable: true
                    }
                ]
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async listRuntimeStateKeys(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const previousNodes = options.previousNodes as ICommonObject[]
            const startAgentflowNode = previousNodes.find((node) => node.name === 'startAgentflow')
            const state = startAgentflowNode?.inputs?.startState as ICommonObject[]
            return state.map((item) => ({ label: item.key, name: item.key }))
        }
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<any> {
        const javascriptFunction = nodeData.inputs?.customFunctionJavascriptFunction as string
        const functionInputVariables = nodeData.inputs?.customFunctionInputVariables as ICustomFunctionInputVariables[]
        const _customFunctionUpdateState = nodeData.inputs?.customFunctionUpdateState

        const state = options.agentflowRuntime?.state as ICommonObject
        const chatId = options.chatId as string
        const isLastNode = options.isLastNode as boolean
        const isStreamable = isLastNode && options.sseStreamer !== undefined

        const appDataSource = options.appDataSource as DataSource
        const databaseEntities = options.databaseEntities as IDatabaseEntity

        // Update flow state if needed
        let newState = { ...state }
        if (_customFunctionUpdateState && Array.isArray(_customFunctionUpdateState) && _customFunctionUpdateState.length > 0) {
            newState = updateFlowState(state, _customFunctionUpdateState)
        }

        const variables = await getVars(appDataSource, databaseEntities, nodeData, options)
        const flow = {
            chatflowId: options.chatflowid,
            sessionId: options.sessionId,
            chatId: options.chatId,
            input,
            state: newState
        }

        // Create additional sandbox variables for custom function inputs
        const additionalSandbox: ICommonObject = {}
        for (const item of functionInputVariables) {
            const variableName = item.variableName
            const variableValue = item.variableValue
            additionalSandbox[`$${variableName}`] = variableValue
        }

        const sandbox = createCodeExecutionSandbox(input, variables, flow, additionalSandbox)

        // Setup streaming function if needed
        const streamOutput = isStreamable
            ? (output: string) => {
                  const sseStreamer: IServerSideEventStreamer = options.sseStreamer
                  sseStreamer.streamTokenEvent(chatId, output)
              }
            : undefined

        try {
            const response = await executeJavaScriptCode(javascriptFunction, sandbox, {
                libraries: ['axios'],
                streamOutput,
                timeout: 10000
            })

            let finalOutput = response
            if (typeof response === 'object') {
                finalOutput = JSON.stringify(response, null, 2)
            }

            // Process template variables in state
            if (newState && Object.keys(newState).length > 0) {
                for (const key in newState) {
                    if (newState[key].toString().includes('{{ output }}')) {
                        newState[key] = newState[key].replaceAll('{{ output }}', finalOutput)
                    }
                }
            }

            const returnOutput = {
                id: nodeData.id,
                name: this.name,
                input: {
                    inputVariables: functionInputVariables,
                    code: javascriptFunction
                },
                output: {
                    content: finalOutput
                },
                state: newState
            }

            return returnOutput
        } catch (e) {
            throw new Error(e)
        }
    }
}

module.exports = { nodeClass: CustomFunction_Agentflow }
