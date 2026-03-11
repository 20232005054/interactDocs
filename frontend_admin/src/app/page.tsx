import Image from 'next/image';
import { BookOpen, Settings, Users, Database } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">管理端控制台</h1>
          <p className="mt-2 text-gray-600">文档管理与系统配置中心</p>
        </div>

        {/* 功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* 模板管理卡片 */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200">
            <div className="flex items-start">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <Database className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">模板管理</h2>
                <p className="text-gray-600 mb-4">管理系统模板的创建、编辑和删除</p>
                <a 
                  href="/templates" 
                  className="inline-flex items-center text-green-600 hover:text-green-800 font-medium"
                >
                  进入管理
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* 系统设置卡片 */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200">
            <div className="flex items-start">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <Settings className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">系统设置</h2>
                <p className="text-gray-600 mb-4">配置系统参数和管理权限</p>
                <a 
                  href="#" 
                  className="inline-flex items-center text-green-600 hover:text-green-800 font-medium"
                >
                  进入设置
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* 用户管理卡片 */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200">
            <div className="flex items-start">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">用户管理</h2>
                <p className="text-gray-600 mb-4">管理用户账号和权限</p>
                <a 
                  href="#" 
                  className="inline-flex items-center text-green-600 hover:text-green-800 font-medium"
                >
                  进入管理
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* 文档管理卡片 */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200">
            <div className="flex items-start">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <BookOpen className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">文档管理</h2>
                <p className="text-gray-600 mb-4">管理系统中的文档</p>
                <a 
                  href="#" 
                  className="inline-flex items-center text-green-600 hover:text-green-800 font-medium"
                >
                  进入管理
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">快速操作</h2>
          <div className="flex flex-wrap gap-3">
            <a 
              href="/templates" 
              className="inline-flex items-center px-4 py-2 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 transition-colors duration-200"
            >
              <Database className="h-4 w-4 mr-2" />
              模板管理
            </a>
            <a 
              href="#" 
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 font-medium rounded-md hover:bg-gray-200 transition-colors duration-200"
            >
              <Settings className="h-4 w-4 mr-2" />
              系统设置
            </a>
            <a 
              href="#" 
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 font-medium rounded-md hover:bg-gray-200 transition-colors duration-200"
            >
              <Users className="h-4 w-4 mr-2" />
              用户管理
            </a>
            <a 
              href="#" 
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 font-medium rounded-md hover:bg-gray-200 transition-colors duration-200"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              文档管理
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}