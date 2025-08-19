// assets
import {
    IconTrash,
    IconFileUpload,
    IconFileExport,
    IconCopy,
    IconMessage,
    IconDatabaseExport,
    IconAdjustmentsHorizontal,
    IconUsers,
    IconTemplate
} from '@tabler/icons-react'

// constant
const icons = {
    IconTrash,
    IconFileUpload,
    IconFileExport,
    IconCopy,
    IconMessage,
    IconDatabaseExport,
    IconAdjustmentsHorizontal,
    IconUsers,
    IconTemplate
}

// ==============================|| SETTINGS MENU ITEMS ||============================== //

const settings = {
    id: 'settings',
    title: '',
    type: 'group',
    children: [
        {
            id: 'viewMessages',
            title: '查看消息',
            type: 'item',
            url: '',
            icon: icons.IconMessage
        },
        {
            id: 'viewLeads',
            title: '查看线索',
            type: 'item',
            url: '',
            icon: icons.IconUsers
        },
        {
            id: 'viewUpsertHistory',
            title: '更新历史',
            type: 'item',
            url: '',
            icon: icons.IconDatabaseExport
        },
        {
            id: 'chatflowConfiguration',
            title: '配置',
            type: 'item',
            url: '',
            permission: 'chatflows:config',
            icon: icons.IconAdjustmentsHorizontal
        },
        {
            id: 'saveAsTemplate',
            title: '保存为模板',
            type: 'item',
            url: '',
            icon: icons.IconTemplate,
            permission: 'templates:flowexport'
        },
        {
            id: 'duplicateChatflow',
            title: '复制聊天工作流',
            type: 'item',
            url: '',
            icon: icons.IconCopy,
            permission: 'chatflows:duplicate'
        },
        {
            id: 'loadChatflow',
            title: '加载聊天工作流',
            type: 'item',
            url: '',
            icon: icons.IconFileUpload,
            permission: 'chatflows:import'
        },
        {
            id: 'exportChatflow',
            title: '导出聊天工作流',
            type: 'item',
            url: '',
            icon: icons.IconFileExport,
            permission: 'chatflows:export'
        },
        {
            id: 'deleteChatflow',
            title: '删除聊天工作流',
            type: 'item',
            url: '',
            icon: icons.IconTrash,
            permission: 'chatflows:delete'
        }
    ]
}

export default settings
