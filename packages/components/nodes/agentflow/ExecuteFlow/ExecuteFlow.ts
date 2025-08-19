import {
    ICommonObject,
    IDatabaseEntity,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeParams,
    IServerSideEventStreamer
} from '../../../src/Interface'
import axios, { AxiosRequestConfig } from 'axios'
import { getCredentialData, getCredentialParam } from '../../../src/utils'
import { DataSource } from 'typeorm'
import { BaseMessageLike } from '@langchain/core/messages'
import { updateFlowState } from '../utils'

class ExecuteFlow_Agentflow implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    color: string
    baseClasses: string[]
    documentation?: string
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = '执行工作流'
        this.name = 'executeFlowAgentflow'
        this.version = 1.1
        this.type = 'ExecuteFlow'
        this.category = 'Agent Flows'
        this.description = '执行另一个工作流'
        this.baseClasses = [this.type]
        this.color = '#a3b18a'
        this.credential = {
            label: '连接凭证',
            name: 'credential',
            type: 'credential',
            credentialNames: ['chatflowApi'],
            optional: true
        }
        this.inputs = [
            {
                label: '选择工作流',
                name: 'executeFlowSelectedFlow',
                type: 'asyncOptions',
                loadMethod: 'listFlows'
            },
            {
                label: '输入',
                name: 'executeFlowInput',
                type: 'string',
                rows: 4,
                acceptVariable: true
            },
            {
                label: '覆盖配置',
                name: 'executeFlowOverrideConfig',
                description: '覆盖传递给工作流的配置',
                type: 'json',
                optional: true,
                acceptVariable: true
            },
            {
                label: 'Base URL',
                name: 'executeFlowBaseURL',
                type: 'string',
                description:
                    '到Flowise的基础URL。默认情况下，它是传入请求的URL。当您需要通过替代路由执行工作流时很有用。',
                placeholder: 'http://localhost:3000',
                optional: true
            },
            {
                label: '返回响应为',
                name: 'executeFlowReturnResponseAs',
                type: 'options',
                options: [
                    {
                        label: '用户消息',
                        name: 'userMessage'
                    },
                    {
                        label: '助手消息',
                        name: 'assistantMessage'
                    }
                ],
                default: 'userMessage'
            },
            {
                label: '更新工作流状态',
                name: 'executeFlowUpdateState',
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
        async listFlows(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            const appDataSource = options.appDataSource as DataSource
            const databaseEntities = options.databaseEntities as IDatabaseEntity
            if (appDataSource === undefined || !appDataSource) {
                return returnData
            }

            const searchOptions = options.searchOptions || {}
            const chatflows = await appDataSource.getRepository(databaseEntities['ChatFlow']).findBy(searchOptions)

            for (let i = 0; i < chatflows.length; i += 1) {
                let cfType = 'Chatflow'
                if (chatflows[i].type === 'AGENTFLOW') {
                    cfType = 'Agentflow V2'
                } else if (chatflows[i].type === 'MULTIAGENT') {
                    cfType = 'Agentflow V1'
                }
                const data = {
                    label: chatflows[i].name,
                    name: chatflows[i].id,
                    description: cfType
                } as INodeOptionsValue
                returnData.push(data)
            }

            // order by label
            return returnData.sort((a, b) => a.label.localeCompare(b.label))
        },
        async listRuntimeStateKeys(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const previousNodes = options.previousNodes as ICommonObject[]
            const startAgentflowNode = previousNodes.find((node) => node.name === 'startAgentflow')
            const state = startAgentflowNode?.inputs?.startState as ICommonObject[]
            return state.map((item) => ({ label: item.key, name: item.key }))
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const baseURL = (nodeData.inputs?.executeFlowBaseURL as string) || (options.baseURL as string)
        const selectedFlowId = nodeData.inputs?.executeFlowSelectedFlow as string
        const flowInput = nodeData.inputs?.executeFlowInput as string
        const returnResponseAs = nodeData.inputs?.executeFlowReturnResponseAs as string
        const _executeFlowUpdateState = nodeData.inputs?.executeFlowUpdateState

        let overrideConfig = nodeData.inputs?.executeFlowOverrideConfig
        if (typeof overrideConfig === 'string' && overrideConfig.startsWith('{') && overrideConfig.endsWith('}')) {
            try {
                // Handle escaped square brackets and other common escape sequences
                const unescapedConfig = overrideConfig.replace(/\\(\[|\])/g, '$1')
                overrideConfig = JSON.parse(unescapedConfig)
            } catch (parseError) {
                throw new Error(`executeFlowOverrideConfig中的JSON无效: ${parseError.message}`)
            }
        }

        const state = options.agentflowRuntime?.state as ICommonObject
        const runtimeChatHistory = (options.agentflowRuntime?.chatHistory as BaseMessageLike[]) ?? []
        const isLastNode = options.isLastNode as boolean
        const sseStreamer: IServerSideEventStreamer | undefined = options.sseStreamer

        try {
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const chatflowApiKey = getCredentialParam('chatflowApiKey', credentialData, nodeData)

            if (selectedFlowId === options.chatflowid) throw new Error('无法调用相同的智能体工作流！')

            let headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'flowise-tool': 'true'
            }
            if (chatflowApiKey) headers = { ...headers, Authorization: `Bearer ${chatflowApiKey}` }

            const finalUrl = `${baseURL}/api/v1/prediction/${selectedFlowId}`
            const requestConfig: AxiosRequestConfig = {
                method: 'POST',
                url: finalUrl,
                headers,
                data: {
                    question: flowInput,
                    chatId: options.chatId,
                    overrideConfig
                }
            }

            const response = await axios(requestConfig)

            let resultText = ''
            if (response.data.text) resultText = response.data.text
            else if (response.data.json) resultText = '```json\n' + JSON.stringify(response.data.json, null, 2)
            else resultText = JSON.stringify(response.data, null, 2)

            if (isLastNode && sseStreamer) {
                sseStreamer.streamTokenEvent(options.chatId, resultText)
            }

            // Update flow state if needed
            let newState = { ...state }
            if (_executeFlowUpdateState && Array.isArray(_executeFlowUpdateState) && _executeFlowUpdateState.length > 0) {
                newState = updateFlowState(state, _executeFlowUpdateState)
            }

            // Process template variables in state
            if (newState && Object.keys(newState).length > 0) {
                for (const key in newState) {
                    if (newState[key].toString().includes('{{ output }}')) {
                        newState[key] = newState[key].replaceAll('{{ output }}', resultText)
                    }
                }
            }

            // Only add to runtime chat history if this is the first node
            const inputMessages = []
            if (!runtimeChatHistory.length) {
                inputMessages.push({ role: 'user', content: flowInput })
            }

            let returnRole = 'user'
            if (returnResponseAs === 'assistantMessage') {
                returnRole = 'assistant'
            }

            const returnOutput = {
                id: nodeData.id,
                name: this.name,
                input: {
                    messages: [
                        {
                            role: 'user',
                            content: flowInput
                        }
                    ]
                },
                output: {
                    content: resultText
                },
                state: newState,
                chatHistory: [
                    ...inputMessages,
                    {
                        role: returnRole,
                        content: resultText,
                        name: nodeData?.label ? nodeData?.label.toLowerCase().replace(/\s/g, '_').trim() : nodeData?.id
                    }
                ]
            }

            return returnOutput
        } catch (error) {
            console.error('ExecuteFlow Error:', error)

            // Format error response
            const errorResponse: any = {
                id: nodeData.id,
                name: this.name,
                input: {
                    messages: [
                        {
                            role: 'user',
                            content: flowInput
                        }
                    ]
                },
                error: {
                    name: error.name || 'Error',
                    message: error.message || '在执行工作流期间发生错误'
                },
                state
            }

            // Add more error details if available
            if (error.response) {
                errorResponse.error.status = error.response.status
                errorResponse.error.statusText = error.response.statusText
                errorResponse.error.data = error.response.data
                errorResponse.error.headers = error.response.headers
            }

            throw new Error(error)
        }
    }
}

module.exports = { nodeClass: ExecuteFlow_Agentflow }
