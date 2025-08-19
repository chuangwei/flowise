import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import {
    ICommonObject,
    ICondition,
    IHumanInput,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeOutputsValue,
    INodeParams,
    IServerSideEventStreamer
} from '../../../src/Interface'
import { AIMessageChunk, BaseMessageLike } from '@langchain/core/messages'
import { DEFAULT_HUMAN_INPUT_DESCRIPTION, DEFAULT_HUMAN_INPUT_DESCRIPTION_HTML } from '../prompt'

class HumanInput_Agentflow implements INode {
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
    outputs: INodeOutputsValue[]

    constructor() {
        this.label = '人工输入'
        this.name = 'humanInputAgentflow'
        this.version = 1.0
        this.type = 'HumanInput'
        this.category = 'Agent Flows'
        this.description = '在执行过程中请求人工输入、批准或拒绝'
        this.color = '#6E6EFD'
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: '描述类型',
                name: 'humanInputDescriptionType',
                type: 'options',
                options: [
                    {
                        label: '固定',
                        name: 'fixed',
                        description: '指定固定描述'
                    },
                    {
                        label: '动态',
                        name: 'dynamic',
                        description: '使用LLM生成描述'
                    }
                ]
            },
            {
                label: '描述',
                name: 'humanInputDescription',
                type: 'string',
                placeholder: '您确定要继续吗？',
                acceptVariable: true,
                rows: 4,
                show: {
                    humanInputDescriptionType: 'fixed'
                }
            },
            {
                label: '模型',
                name: 'humanInputModel',
                type: 'asyncOptions',
                loadMethod: 'listModels',
                loadConfig: true,
                show: {
                    humanInputDescriptionType: 'dynamic'
                }
            },
            {
                label: '提示',
                name: 'humanInputModelPrompt',
                type: 'string',
                default: DEFAULT_HUMAN_INPUT_DESCRIPTION_HTML,
                acceptVariable: true,
                generateInstruction: true,
                rows: 4,
                show: {
                    humanInputDescriptionType: 'dynamic'
                }
            },
            {
                label: '启用反馈',
                name: 'humanInputEnableFeedback',
                type: 'boolean',
                default: true
            }
        ]
        this.outputs = [
            {
                label: '继续',
                name: 'proceed'
            },
            {
                label: '拒绝',
                name: 'reject'
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async listModels(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const componentNodes = options.componentNodes as {
                [key: string]: INode
            }

            const returnOptions: INodeOptionsValue[] = []
            for (const nodeName in componentNodes) {
                const componentNode = componentNodes[nodeName]
                if (componentNode.category === 'Chat Models') {
                    if (componentNode.tags?.includes('LlamaIndex')) {
                        continue
                    }
                    returnOptions.push({
                        label: componentNode.label,
                        name: nodeName,
                        imageSrc: componentNode.icon
                    })
                }
            }
            return returnOptions
        }
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const _humanInput = nodeData.inputs?.humanInput
        const humanInput: IHumanInput = typeof _humanInput === 'string' ? JSON.parse(_humanInput) : _humanInput

        const humanInputEnableFeedback = nodeData.inputs?.humanInputEnableFeedback as boolean
        let humanInputDescriptionType = nodeData.inputs?.humanInputDescriptionType as string
        const model = nodeData.inputs?.humanInputModel as string
        const modelConfig = nodeData.inputs?.humanInputModelConfig as ICommonObject
        const _humanInputModelPrompt = nodeData.inputs?.humanInputModelPrompt as string
        const humanInputModelPrompt = _humanInputModelPrompt ? _humanInputModelPrompt : DEFAULT_HUMAN_INPUT_DESCRIPTION

        // Extract runtime state and history
        const state = options.agentflowRuntime?.state as ICommonObject
        const pastChatHistory = (options.pastChatHistory as BaseMessageLike[]) ?? []
        const runtimeChatHistory = (options.agentflowRuntime?.chatHistory as BaseMessageLike[]) ?? []

        const chatId = options.chatId as string
        const isStreamable = options.sseStreamer !== undefined

        if (humanInput) {
            const outcomes: Partial<ICondition>[] & Partial<IHumanInput>[] = [
                {
                    type: 'proceed',
                    startNodeId: humanInput?.startNodeId,
                    feedback: humanInputEnableFeedback && humanInput?.feedback ? humanInput.feedback : undefined,
                    isFulfilled: false
                },
                {
                    type: 'reject',
                    startNodeId: humanInput?.startNodeId,
                    feedback: humanInputEnableFeedback && humanInput?.feedback ? humanInput.feedback : undefined,
                    isFulfilled: false
                }
            ]

            // Only one outcome can be fulfilled at a time
            switch (humanInput?.type) {
                case 'proceed':
                    outcomes[0].isFulfilled = true
                    break
                case 'reject':
                    outcomes[1].isFulfilled = true
                    break
            }

            const messages = [
                ...pastChatHistory,
                ...runtimeChatHistory,
                {
                    role: 'user',
                    content: humanInput.feedback || humanInput.type
                }
            ]
            const input = { ...humanInput, messages }
            const output = { conditions: outcomes }

            const nodeOutput = {
                id: nodeData.id,
                name: this.name,
                input,
                output,
                state
            }

            if (humanInput.feedback) {
                ;(nodeOutput as any).chatHistory = [{ role: 'user', content: humanInput.feedback }]
            }

            return nodeOutput
        } else {
            let humanInputDescription = ''

            if (humanInputDescriptionType === 'fixed') {
                humanInputDescription = (nodeData.inputs?.humanInputDescription as string) || '您想要继续吗？'
                const messages = [...pastChatHistory, ...runtimeChatHistory]
                // Find the last message in the messages array
                const lastMessage = (messages[messages.length - 1] as any).content || ''
                humanInputDescription = `${lastMessage}\n\n${humanInputDescription}`
                if (isStreamable) {
                    const sseStreamer: IServerSideEventStreamer = options.sseStreamer as IServerSideEventStreamer
                    sseStreamer.streamTokenEvent(chatId, humanInputDescription)
                }
            } else {
                if (model && modelConfig) {
                    const nodeInstanceFilePath = options.componentNodes[model].filePath as string
                    const nodeModule = await import(nodeInstanceFilePath)
                    const newNodeInstance = new nodeModule.nodeClass()
                    const newNodeData = {
                        ...nodeData,
                        credential: modelConfig['FLOWISE_CREDENTIAL_ID'],
                        inputs: {
                            ...nodeData.inputs,
                            ...modelConfig
                        }
                    }
                    const llmNodeInstance = (await newNodeInstance.init(newNodeData, '', options)) as BaseChatModel
                    const messages = [
                        ...pastChatHistory,
                        ...runtimeChatHistory,
                        {
                            role: 'user',
                            content: humanInputModelPrompt || DEFAULT_HUMAN_INPUT_DESCRIPTION
                        }
                    ]

                    let response: AIMessageChunk = new AIMessageChunk('')
                    if (isStreamable) {
                        const sseStreamer: IServerSideEventStreamer = options.sseStreamer as IServerSideEventStreamer
                        for await (const chunk of await llmNodeInstance.stream(messages)) {
                            sseStreamer.streamTokenEvent(chatId, chunk.content.toString())
                            response = response.concat(chunk)
                        }
                        humanInputDescription = response.content as string
                    } else {
                        const response = await llmNodeInstance.invoke(messages)
                        humanInputDescription = response.content as string
                    }
                }
            }

            const input = { messages: [...pastChatHistory, ...runtimeChatHistory], humanInputEnableFeedback }
            const output = { content: humanInputDescription }
            const nodeOutput = {
                id: nodeData.id,
                name: this.name,
                input,
                output,
                state,
                chatHistory: [{ role: 'assistant', content: humanInputDescription }]
            }

            return nodeOutput
        }
    }
}

module.exports = { nodeClass: HumanInput_Agentflow }
