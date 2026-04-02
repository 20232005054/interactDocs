class EdgeSourceType:
    CHAPTER = "chapter"
    SUMMARY = "summary"


class EdgeTargetType:
    CORE_INFO = "core_info"   # 原 document_entity，指向 DocumentCoreInfo
    SUMMARY   = "summary"
    CHAPTER   = "chapter"
    KEYWORD   = "keyword"
