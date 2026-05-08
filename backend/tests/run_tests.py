"""
测试运行脚本

提供便捷的测试运行命令
"""

import subprocess
import sys
from pathlib import Path


def run_command(cmd: list[str], description: str):
    """运行命令"""
    print(f"\n{'=' * 60}")
    print(f"{description}")
    print(f"{'=' * 60}\n")
    
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent)
    
    if result.returncode != 0:
        print(f"\n❌ {description} 失败")
        return False
    else:
        print(f"\n✅ {description} 成功")
        return True


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法:")
        print("  python run_tests.py all          # 运行所有测试")
        print("  python run_tests.py unit         # 运行单元测试")
        print("  python run_tests.py integration  # 运行集成测试")
        print("  python run_tests.py performance  # 运行性能测试")
        print("  python run_tests.py ab           # 运行 A/B 测试")
        print("  python run_tests.py coverage     # 生成覆盖率报告")
        print("  python run_tests.py quick        # 快速测试（跳过慢速测试）")
        return
    
    test_type = sys.argv[1]
    
    if test_type == "all":
        # 运行所有测试
        run_command(
            ["pytest", "tests/", "-v"],
            "运行所有测试"
        )
    
    elif test_type == "unit":
        # 运行单元测试
        run_command(
            ["pytest", "tests/langchain/", "-v"],
            "运行单元测试"
        )
    
    elif test_type == "integration":
        # 运行集成测试
        run_command(
            ["pytest", "tests/integration/", "-v"],
            "运行集成测试"
        )
    
    elif test_type == "performance":
        # 运行性能测试
        run_command(
            ["pytest", "tests/performance/", "-v", "-s"],
            "运行性能测试"
        )
    
    elif test_type == "ab":
        # 运行 A/B 测试
        run_command(
            ["pytest", "tests/ab_testing/", "-v", "-s"],
            "运行 A/B 测试"
        )
    
    elif test_type == "coverage":
        # 生成覆盖率报告
        success = run_command(
            [
                "pytest",
                "tests/",
                "--cov=services/langchain",
                "--cov=services/service_router",
                "--cov=core/performance_monitor",
                "--cov-report=html",
                "--cov-report=term",
                "--cov-report=json",
            ],
            "生成覆盖率报告"
        )
        
        if success:
            print("\n📊 覆盖率报告已生成:")
            print("  - HTML: htmlcov/index.html")
            print("  - JSON: coverage.json")
    
    elif test_type == "quick":
        # 快速测试（跳过慢速测试）
        run_command(
            ["pytest", "tests/", "-v", "-m", "not slow"],
            "快速测试"
        )
    
    else:
        print(f"❌ 未知的测试类型: {test_type}")
        return


if __name__ == "__main__":
    main()
