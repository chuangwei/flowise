import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'

class Start_Agentflow implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    color: string
    hideInput: boolean
    baseClasses: string[]
    documentation?: string
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = '开始'
        this.name = 'startAgentflow'
        this.version = 1.1
        this.type = 'Start'
        this.category = 'Agent Flows'
        this.description = '智能体工作流的起始点'
        this.baseClasses = [this.type]
        this.color = '#7EE787'
        this.hideInput = true
        this.inputs = [
            {
                label: '输入类型',
                name: 'startInputType',
                type: 'options',
                options: [
                    {
                        label: '聊天输入',
                        name: 'chatInput',
                        description: '通过聊天输入开始对话'
                    },
                    {
                        label: '表单输入',
                        name: 'formInput',
                        description: '通过表单输入开始工作流'
                    }
                ],
                default: 'chatInput'
            },
            {
                label: '表单标题',
                name: 'formTitle',
                type: 'string',
                placeholder: '请填写表单',
                show: {
                    startInputType: 'formInput'
                }
            },
            {
                label: '表单描述',
                name: 'formDescription',
                type: 'string',
                placeholder: '请完成下方所有字段以继续',
                show: {
                    startInputType: 'formInput'
                }
            },
            {
                label: '表单输入类型',
                name: 'formInputTypes',
                description: '指定表单输入的类型',
                type: 'array',
                show: {
                    startInputType: 'formInput'
                },
                array: [
                    {
                        label: '类型',
                        name: 'type',
                        type: 'options',
                        options: [
                            {
                                label: '字符串',
                                name: 'string'
                            },
                            {
                                label: '数字',
                                name: 'number'
                            },
                            {
                                label: '布尔值',
                                name: 'boolean'
                            },
                            {
                                label: '选项',
                                name: 'options'
                            }
                        ],
                        default: 'string'
                    },
                    {
                        label: '标签',
                        name: 'label',
                        type: 'string',
                        placeholder: '输入的标签'
                    },
                    {
                        label: '变量名',
                        name: 'name',
                        type: 'string',
                        placeholder: '输入的变量名（必须是驼峰命名）',
                        description: '变量名必须是驼峰命名。例如：firstName、lastName 等。'
                    },
                    {
                        label: '添加选项',
                        name: 'addOptions',
                        type: 'array',
                        show: {
                            'formInputTypes[$index].type': 'options'
                        },
                        array: [
                            {
                                label: '选项',
                                name: 'option',
                                type: 'string'
                            }
                        ]
                    }
                ]
            },
            {
                label: '临时性记忆',
                name: 'startEphemeralMemory',
                type: 'boolean',
                description: '每次执行时都重新开始，不包含历史聊天记录，适用于单轮对话',
                optional: true
            },
            {
                label: '工作流状态',
                name: 'startState',
                description: '工作流执行期间的运行状态',
                type: 'array',
                optional: true,
                array: [
                    {
                        label: '键',
                        name: 'key',
                        type: 'string',
                        placeholder: '示例键'
                    },
                    {
                        label: '值',
                        name: 'value',
                        type: 'string',
                        placeholder: '示例值',
                        optional: true
                    }
                ]
            },
            {
                label: '持久化状态',
                name: 'startPersistState',
                type: 'boolean',
                description: '在同一会话中持久化状态，工作流再次执行时，会获取上一次的运行状态',
                optional: true
            }
        ]
    }

    async run(nodeData: INodeData, input: string | Record<string, any>, options: ICommonObject): Promise<any> {
        const _flowState = nodeData.inputs?.startState as string
        const startInputType = nodeData.inputs?.startInputType as string
        const startEphemeralMemory = nodeData.inputs?.startEphemeralMemory as boolean
        const startPersistState = nodeData.inputs?.startPersistState as boolean

        let flowStateArray = []
        if (_flowState) {
            try {
                flowStateArray = typeof _flowState === 'string' ? JSON.parse(_flowState) : _flowState
            } catch (error) {
                throw new Error('无效的工作流状态')
            }
        }

        let flowState: Record<string, any> = {}
        for (const state of flowStateArray) {
            flowState[state.key] = state.value
        }

        const runtimeState = options.agentflowRuntime?.state as ICommonObject
        if (startPersistState === true && runtimeState && Object.keys(runtimeState).length) {
            for (const state in runtimeState) {
                flowState[state] = runtimeState[state]
            }
        }

        const inputData: ICommonObject = {}
        const outputData: ICommonObject = {}

        if (startInputType === 'chatInput') {
            inputData.question = input
            outputData.question = input
        }

        if (startInputType === 'formInput') {
            inputData.form = {
                title: nodeData.inputs?.formTitle,
                description: nodeData.inputs?.formDescription,
                inputs: nodeData.inputs?.formInputTypes
            }

            let form = input
            if (options.agentflowRuntime?.form && Object.keys(options.agentflowRuntime.form).length) {
                form = options.agentflowRuntime.form
            }
            outputData.form = form
        }

        if (startEphemeralMemory) {
            outputData.ephemeralMemory = true
        }

        if (startPersistState) {
            outputData.persistState = true
        }

        const returnOutput = {
            id: nodeData.id,
            name: this.name,
            input: inputData,
            output: outputData,
            state: flowState
        }

        return returnOutput
    }
}

module.exports = { nodeClass: Start_Agentflow }
